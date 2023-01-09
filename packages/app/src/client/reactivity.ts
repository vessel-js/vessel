export interface Unsubscribe {
  (): void;
}

export interface Reactive<T> {
  get(): T;
  set(newValue: T): void;
  subscribe(onUpdate: (value: T) => void): Unsubscribe;
}

export interface ReactiveFactory {
  <T>(value: T): Reactive<T>;
}
