import {
  computed,
  effectScope,
  getCurrentInstance,
  inject,
  isRef,
  reactive,
  toRefs,
} from "vue";
import { isObject } from "@vue/shared";
import { SymbolPinia, setActivePinia, activePinia } from "./rootStore";
import { watch } from "vue";
import { addSubscription, triggerSubscription } from "./pubSub";
export function defineStore(idOrOptions: any, setup: any) {
  let id: any;
  let options: any;

  if (typeof idOrOptions === "string") {
    id = idOrOptions;
    options = setup;
  } else {
    options = idOrOptions;
    id = idOrOptions.id;
  }

  //如果是函数 说明是一个setup函数
  const isSetupStore = typeof setup === "function";

  function useStore() {
    //获取当前组件的实例
    const currentInstance = getCurrentInstance();

    //注册了一个store

    let pinia: any = currentInstance && inject(SymbolPinia);
    if (pinia) setActivePinia(pinia);
    pinia = activePinia;
    if (!pinia._s.has(id)) {
      if (isSetupStore) {
        createSetupStore(id, setup, pinia);
      } else {
        createOptionsStore(id, options, pinia);
      }
    }

    const store = pinia._s.get(id);
    return store;
  }

  return useStore;
}

function mergeReactiveObject(target:any, partialState: any) {
  for(let key in partialState){
    if (!partialState.hasOwnProperty(key)) continue
    const oldValue = target[key]
    const newValue = partialState[key]
    //状态有可能是ref ref是一个对象不能递归
    if (isObject(oldValue) && isObject(newValue) && isRef(newValue)) {
      target[key] = mergeReactiveObject(oldValue, newValue)
    }else{
      target[key] = newValue
    }
  }
  return target
}

function createSetupStore(id: any, setup: any, pinia: any) {
  function $patch(partialStateOrMutation:any) {
    if (typeof partialStateOrMutation === 'function') {
      partialStateOrMutation(store)
    }else{
      mergeReactiveObject(store, partialStateOrMutation)
    }
  }
  let scope:any;

  let actionSubscribes:any = []

  const partialStore = {
    $patch,
    $reset:() => {},
    $subscribe(callback:any, options:any){
      scope.run(() => watch(pinia.state.value[id], (state:any) => {
        callback({type:'dirct'}, state)
      },options))
    },
    $onAction:addSubscription.bind(null, actionSubscribes),
    $dispose:() => {
      scope.stop()
      actionSubscribes = []
      pinia._s.delete(id) //删除store 数据变化了不会再更新试图
    }
  }



  const store = reactive(partialStore);

  Object.defineProperty(store, '$state', {
    get:() => pinia.state.value[id],
    set:(state:any) => $patch(($state:any) => Object.assign($state, state))
  })

  const setupStore = pinia._e.run(() => {
    scope = effectScope();
    return scope.run(() => setup(store));
  });

  function wrapAction(name: any, action: any) {
    return function () {

      const afterCallbackList:any = []
      const onErrorCallbackList: any = []

      function after(callback: any) {
        afterCallbackList.push(callback)
      }

      function onError(callback: any) {
        afterCallbackList.push(callback)
      }

      triggerSubscription(actionSubscribes, {after, onError,store,name})

      let ret
      try {
        ret = action.apply(store, arguments);
      } catch (error) {
        triggerSubscription(onErrorCallbackList, error)
      }

      if (ret instanceof Promise) {
        return ret.then((value) => {
          triggerSubscription(afterCallbackList, value)
        }).catch((error) => {
          triggerSubscription(onErrorCallbackList, error)
          return Promise.reject(error)
        })
      }else{
        triggerSubscription(afterCallbackList, ret)
      }
      

      return ret;
    };
  }

  for (let key in setupStore) {
    const prop = setupStore[key];
    if (typeof prop === "function") {
      setupStore[key] = wrapAction(key, prop);
    }
  }

  //最终会将处理好的setupStore放入store中
  Object.assign(store, setupStore);
  pinia._s.set(id, store);
  return store;
}

function createOptionsStore(id: any, options: any, pinia: any) {
  let { state, getters, actions } = options;

  function setup() {
    //ref放入的是对象 会被自动proxy
    pinia.state.value[id] = state ? state() : {};
    const localState = toRefs(pinia.state.value[id]);
    return Object.assign(
      localState,
      actions,
      Object.keys(getters || {}).reduce((computedGetters: any, name) => {
        computedGetters[name] = computed(() => {
          return getters[name].call(store, store);
        });
        return computedGetters;
      }, {})
    );
  }
  const store = createSetupStore(id, setup, pinia);

  store.$reset = function () {
    const newState = state ? state() : {}
    store.$patch(($state:any) =>{
      Object.assign($state, newState)
    })
  }

  return store;
}
