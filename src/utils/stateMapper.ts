import { useEffect, useState } from "react";

function createMappedStateHook<T>(getValue: () => T, callbacks: Set<Function>) {
    return function useMappedState() {
        const [value, setValue] = useState<T>(getValue);
        useEffect(() => {
            const update = () => setValue(getValue());
            callbacks.add(update);
            return () => {
                callbacks.delete(update);
            };
        }, []);
        return value;
    };
}

export default class StateMapper<T> {
    private getFun: () => T;
    private cbs: Set<Function> = new Set([]);
    constructor(getFun: () => T) {
        this.getFun = getFun;
    }

    notify = () => {
        this.cbs.forEach(_ => _?.());
    };

    useMappedState = createMappedStateHook(() => this.getFun(), this.cbs);

}

type UpdateFunc<T> = (prev: T) => T;

export class GlobalState<T> {
    private value: T;
    private stateMapper: StateMapper<T>;

    constructor(initValue: T) {
        this.value = initValue;
        this.stateMapper = new StateMapper(this.getValue);
    }

    public getValue = () => {
        return this.value;
    };

    public useValue = () => {
        return this.stateMapper.useMappedState();
    };

    public setValue = (value: T | UpdateFunc<T>) => {
        let newValue: T;
        if (typeof value === "function") {
            newValue = (value as UpdateFunc<T>)(this.value);
        } else {
            newValue = value;
        }

        this.value = newValue;
        this.stateMapper.notify();
    };
}
