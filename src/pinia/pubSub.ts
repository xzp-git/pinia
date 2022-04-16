export function addSubscription(subscriptions:any, cb:any) {
    subscriptions.push(cb)
    return function removeSubscription() {
        const idx = subscriptions.indexOf(cb)
        if (idx > -1) {
            subscriptions.splice(idx,1)
        }
    }
}

export function triggerSubscription(subscriptions:any, ...args:any) {
    subscriptions.forEach((cb:any) => {
        cb(...args)
    });
}