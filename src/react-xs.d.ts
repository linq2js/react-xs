declare module "react-xs" {
  import * as React from "react";

  type Unpacked<T> = T extends (infer U)[]
    ? U
    : T extends (...args: any[]) => infer U
    ? U
    : T extends Promise<infer U>
    ? U
    : T;

  type Func<A = any, B = any> = (a: A) => B;

  type Equality<TType = any> = (a: TType, b: TType) => boolean;

  type HocCallback<
    TProps = any,
    THocProps = any,
    TComponent extends React.ComponentType<TProps> = never
  > = (
    props: THocProps,
    component?: TComponent
  ) => TComponent extends never ? TProps & THocProps : React.ReactElement;

  type Unsubscribe = () => void;

  type DateDuration =
    | "D"
    | "M"
    | "Y"
    | "W"
    | "h"
    | "m"
    | "s"
    | "ms"
    | "day"
    | "month"
    | "year"
    | "week"
    | "hour"
    | "minute"
    | "second"
    | "milli";

  interface StateAsyncParams<TType = any> {
    done?:
      | ((value: TType, error: any) => React.ReactElement | any)
      | string
      | number;
    loading?: (() => React.ReactElement | any) | string | number;
    success?: ((value: TType) => React.ReactElement | any) | string | number;
    error?: ((error: any) => React.ReactElement | any) | string | number;
    fallback?: (() => React.ReactElement | any) | string | number;
  }

  interface AsyncState<TType = any> {
    value: TType;
    loading: boolean;
    done: boolean;
    error?: any;
  }

  interface State<TType = any> {
    value: TType;
    inputProps: StateInputProps<TType>;
    prop: StateProp;
    get: StateGet;
    subscribe: StateSubscribe<TType>;
    unsubscribe: StateUnsubscribe<TType>;
    tap: StateTap<TType>;
    mutate: StateMutate<TType>;
    compute: StateCompute<TType>;
    async: StateAsync<TType>;
  }

  interface NumberState extends State<number> {
    add(value: number): ReturnType<StateMutate<number>>;

    mul(value: number): ReturnType<StateMutate<number>>;

    div(value: number): ReturnType<StateMutate<number>>;
  }

  interface DateState extends State<Date> {
    add(
      value: number,
      dateModifier: DateDuration
    ): ReturnType<StateMutate<Date>>;

    add(
      ...dateModifiers: [number, DateDuration][]
    ): ReturnType<StateMutate<Date>>;
  }

  interface StringState extends State<string> {
    replace(
      match: string | RegExp,
      replacer: string | ((substr: string, ...args: string[]) => string)
    ): ReturnType<StateMutate<string>>;

    /**
     *
     * @deprecated Use substring() instead
     */
    substr(start: number, length?: number): ReturnType<StateMutate<string>>;

    substring(
      indexStart: number,
      indexEnd?: number
    ): ReturnType<StateMutate<string>>;

    trim(): ReturnType<StateMutate<string>>;

    upper(): ReturnType<StateMutate<string>>;

    lower(): ReturnType<StateMutate<string>>;
  }

  interface ObjectState<TType extends {} = any> extends State<TType> {
    def<TValue>(
      path: string | string[],
      value: TValue
    ): ReturnType<StateMutate<TType>>;

    toggle(...props: Array<keyof TType>): ReturnType<StateMutate<TType>>;

    unset(...props: Array<keyof TType>): ReturnType<StateMutate<TType>>;

    set<TValue = never>(
      propOrValue: TType | string | string[],
      value?: TValue
    ): State<TType>;

    assign(
      ...objs: Array<{ [key in keyof TType]: TType[key] }>
    ): ReturnType<StateMutate<TType>>;
  }

  interface ArrayState<TType = any> extends State<TType[]> {
    first(defaultValue?: TType): TType;

    last(defaultValue?: TType): TType;

    push(...items: TType[]): ReturnType<StateMutate<TType[]>>;

    pop(): ReturnType<StateMutate<TType[]>>;

    shift(): ReturnType<StateMutate<TType[]>>;

    unshift(...items: TType[]): ReturnType<StateMutate<TType[]>>;

    splice(
      start: number,
      deleteCount?: number,
      ...items: TType[]
    ): ReturnType<StateMutate<TType[]>>;

    filter(
      predicate: (item: TType) => boolean
    ): ReturnType<StateMutate<TType[]>>;

    orderBy(
      prop: string | ((item: TType) => number),
      desc?: boolean
    ): ReturnType<StateMutate<TType[]>>;

    orderBy(orders: {
      [prop: string]: boolean;
    }): ReturnType<StateMutate<TType[]>>;

    orderBy(
      ...orders: [string | ((item: TType) => number), boolean][]
    ): ReturnType<StateMutate<TType[]>>;

    sort(
      sortFn?: (first: TType, second: TType) => number
    ): ReturnType<StateMutate<TType[]>>;

    concat(...items: TType[]): ReturnType<StateMutate<TType[]>>;

    fill(...items: TType[]): ReturnType<StateMutate<TType[]>>;

    flat(depth?: number): ReturnType<StateMutate<TType[]>>;

    map<TMapResult>(
      mapFn: (item: TType, index?: number, array?: TType[]) => TMapResult
    ): ReturnType<StateMutate<TMapResult[]>>;

    reverse(): ReturnType<StateMutate<TType[]>>;

    slice(begin?: number, end?: number): ReturnType<StateMutate<TType[]>>;

    exclude(...items: TType[]): State<TType[]>;

    remove(...indexes: number[]): State<TType[]>;

    filterMap<TMapResult>(
      predicate: (item: TType, index?: number, array?: TType[]) => boolean,
      mapper: (item: TType, index?: number, array?: TType[]) => TMapResult
    ): ReturnType<StateMutate<TType[]>>;

    swap(
      sourceIndex: number,
      destinationIndex: number
    ): ReturnType<StateMutate<TType[]>>;
  }

  type XsState<TType = any> = TType extends number
    ? NumberState
    : TType extends string
    ? StringState
    : TType extends Date
    ? DateState
    : TType extends {}
    ? ObjectState<TType>
    : TType extends []
    ? ArrayState<TType>
    : State<TType>;

  interface SubscribeOptions {
    debounce?: boolean;
  }

  interface ComputeOptions extends SubscribeOptions {
    onError?: (err: Error | any) => void;
    lazy?: boolean;
  }

  type OnChangeHandler<TType = any> = (val: TType) => void;

  interface StateInputProps<TType = any> {
    value: TType;
    onChange: OnChangeHandler<TType>;
  }

  type StateProp<TDestinationType = any> = (
    path: string | string[]
  ) => State<TDestinationType>;
  type StateGet<TDestinationType = any> = (
    path: string | string[]
  ) => ReturnType<StateProp<TDestinationType>>["value"];

  type StateSubscription<TType = any> = (value: TType) => void;
  type StateSubscribe<TType = any> = (
    subscription: StateSubscription<TType>,
    options?: SubscribeOptions
  ) => Unsubscribe;
  type StateUnsubscribe<TType = any> = (
    subscription: StateSubscription<TType>
  ) => void;
  type StateTap<TType = any> = (
    tapAction: (state: State<TType>, value: TType) => void
  ) => State<TType>;
  type StateMutate<TType = any, TReturnType = never> = (
    mutateAction: (
      value: TType
    ) => TReturnType extends never ? TType : TReturnType,
    needClone: boolean
  ) => State<TReturnType extends never ? TReturnType : TType>;
  type StateCompute<TType = any> = (
    states: Array<State>,
    computer: () => TType,
    options?: ComputeOptions
  ) => State<TType>;
  type StateAsync<TType = any> = (
    params: PromiseLike<TType> | StateAsyncParams<TType>
  ) => ReturnType<StateMutate<TType, AsyncState<TType>>>;

  interface XsComponentOptions<TProps = any> {
    unmount: Array<(props: TProps) => void>;
    one: Array<(props: TProps) => void>;
    many: Array<(props: TProps) => void>;
    states: { [key: string]: State };
    actions: { [key: string]: (props: TProps, ...args: any[]) => void };
  }

  interface XsStateOptions<TType = any> {
    comparer: Equality<TType>
  }

  interface Xs {
    <TType = any>(defaultValue?: TType, options?: Partial<XsStateOptions<TType>>): XsState<TType>;

    <TType, TProps>(
      component: React.ComponentType<TProps>
    ): React.ComponentType<TProps & { [key: string]: any }>;

    <TType, TProps>(
      options: Partial<XsComponentOptions>,
      component: React.ComponentType<TProps>
    ): React.ComponentType<TProps & { [key: string]: any }>;

    compose<
      TFn extends Func,
      TFns extends Array<Func>,
      TReturn extends TFns extends []
        ? TFn
        : TFns extends [Func<infer A, any>]
        ? Func<A, ReturnType<TFn>>
        : TFns extends [any, Func<infer A, any>]
        ? Func<A, ReturnType<TFn>>
        : TFns extends [any, any, Func<infer A, any>]
        ? Func<A, ReturnType<TFn>>
        : TFns extends [any, any, any, Func<infer A, any>]
        ? Func<A, ReturnType<TFn>>
        : TFns extends [any, any, any, any, Func<infer A, any>]
        ? Func<A, ReturnType<TFn>>
        : TFns extends [any, any, any, any, any, Func<infer A, any>]
        ? Func<A, ReturnType<TFn>>
        : TFns extends [any, any, any, any, any, any, Func<infer A, any>]
        ? Func<A, ReturnType<TFn>>
        : TFns extends [any, any, any, any, any, any, any, Func<infer A, any>]
        ? Func<A, ReturnType<TFn>>
        : TFns extends [
            any,
            any,
            any,
            any,
            any,
            any,
            any,
            any,
            Func<infer A, any>
          ]
        ? Func<A, ReturnType<TFn>>
        : Func<any, ReturnType<TFn>>
    >(
      fn: TFn,
      ...fns: TFns
    ): TReturn;

    hoc<TProps>(
      options: Partial<XsComponentOptions>
    ): Func<
      React.ComponentType,
      React.ComponentType<TProps & { [key: string]: any }>
    >;

    hoc<TProps>(
      ...callbacks: HocCallback[]
    ): Func<
      React.ComponentType,
      React.ComponentType<TProps & { [key: string]: any }>
    >;

    bind<TProps>(action: React.ComponentType<TProps>, props?: TProps): void;

    mutate(action: () => void): void;

    clone<TType>(value: TType): TType;

    extend(...args: any[]): void;

    get<
      TStateMap extends {} = any,
      TReturn extends TStateMap extends { [key: string]: State<infer T> }
        ? { [key: string]: T }
        : {} = any
    >(
      stateMap: TStateMap
    ): TReturn;

    set<
      TStateMap extends {} = any,
      TData extends TStateMap extends { [key: string]: State<infer T> }
        ? { [key: string]: T }
        : {} = any
    >(
      stateMap: TStateMap,
      data?: TData
    ): void;

    unmount<TProps = any>(...callbacks: Array<(props: TProps) => void>): void;

    one<TProps = any>(...actions: Array<(props: TProps) => void>): void;

    many<TProps = any>(
      action: (props: TProps) => void,
      argResolver:
        | Array<TProps[keyof TProps]>
        | ((props: TProps) => Array<TProps[keyof TProps]>)
    ): void;

    subscribe<TStates extends Array<State> = [State]>(
      states: TStates,
      subscription: () => void,
      options?: SubscribeOptions
    ): void;
  }

  const $: Xs;
  export default $;
}
