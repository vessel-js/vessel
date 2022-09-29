export type Unsubscribe = () => void;

export type Reactive<T> = {
  get(): T;
  subscribe(onUpdate: (value: T) => void): Unsubscribe;
  set(newValue: T): void;
};

export type ReactiveFactory = {
  <T>(value: T): Reactive<T>;
};
