import {
  computed,
  effectScope,
  getCurrentInstance,
  inject,
  reactive,
  toRefs,
} from "vue";
import { SymbolPinia, setActivePinia, activePinia } from "./rootStore";
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

function createSetupStore(id: any, setup: any, pinia: any) {
  const store = reactive({});

  let scope;
  const setupStore = pinia._e.run(() => {
    scope = effectScope();
    return scope.run(() => setup(store));
  });

  function wrapAction(name: any, action: any) {
    return function () {
      let ret = action.apply(store, arguments);

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

  return store;
}
