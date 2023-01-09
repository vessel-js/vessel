export type Maybe<T> = T | null | undefined | false;

export type AttrValue = string | number | boolean;

export type ReactiveAttrValue<T = AttrValue> = Maybe<T> | (() => Maybe<T>);

export interface AttrValueResolver {
  <T extends AttrValue>(value: ReactiveAttrValue<T>): T | null | undefined;
}

export type ReactiveAttrs<T> = {
  [P in keyof T]?: ReactiveAttrValue<T[P]>;
};

export interface HeadAttributes {
  [attrName: string]: ReactiveAttrValue;
}
