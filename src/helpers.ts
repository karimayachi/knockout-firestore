export function mergeObjects<TTarget, TSource>(target: TTarget, source: TSource): TTarget & TSource {

    let newTarget: TTarget & TSource = <TTarget & TSource>target;

    /* insert the prototype of source into target prototype chain (just one level deep) */
    let pSource: any = Object.getPrototypeOf(source);
    let pTarget: any = Object.getPrototypeOf(target);
    Object.setPrototypeOf(pSource, pTarget);
    Object.setPrototypeOf(target, pSource);

    /* copy the properties (not on the prototype chain, but including the non-enumerable) to the target */
    for (let key of Object.getOwnPropertyNames(source)) {
        let descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(source, key);

        if (descriptor && (!descriptor.writable || !descriptor.configurable || !descriptor.enumerable || descriptor.get || descriptor.set)) {
            Object.defineProperty(target, key, descriptor);
        }
        else {
            (<any>target)[key] = (<any>source)[key];
        }
    }

    return newTarget;
}