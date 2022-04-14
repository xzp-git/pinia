export const SymbolPinia = Symbol("pinia");
export let activePinia;
export const setActivePinia = (pinia) => (activePinia = pinia);
