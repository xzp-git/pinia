export const SymbolPinia = Symbol("pinia");
export let activePinia: any;
export const setActivePinia = (pinia: any) => (activePinia = pinia);
