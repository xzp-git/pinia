import { effectScope, markRaw, ref } from "vue";
import { SymbolPinia } from "./rootStore";

export function createPinia() {
  const scope = effectScope(true);

  //run方法的返回值就是这个fn的返回结果
  const state = scope.run(() => ref({}));

  const _p: any = [];

  const pinia = markRaw({
    install(app: any) {
      pinia._a = app;
      app.provide(SymbolPinia, pinia);
      app.config.globalProperties.$pinia = pinia;
    },
    _p,
    _a: null,
    state, //所有的状态
    _e: scope,
    _s: new Map(), //所有的store
  });

  return pinia;
}
