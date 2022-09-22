export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
export type Immutable<T> = { readonly [P in keyof T]: T[P] };
