export function mergeObjects<TTarget, TSource>(target: TTarget, source: TSource): TTarget & TSource {

    let newTarget: TTarget & TSource = <TTarget & TSource>target;
    let pSource: any = Object.getPrototypeOf(source);
    
    addPrototypeToEndOfChain(target, pSource);

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

function addPrototypeToEndOfChain(chain: any, prototype: any) {
    let pTarget: any = Object.getPrototypeOf(chain);

    if(pTarget === prototype) {  /* prototype already added to this chain */
    }
    else if(pTarget === Object.prototype || pTarget === Function.prototype) { /* end of chain: add prototype */
        Object.setPrototypeOf(chain, prototype);
    }
    else { /* recursive go down chain */
        addPrototypeToEndOfChain(pTarget, prototype);
    }
}