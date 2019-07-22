import {
  memo,
  useCallback,
  useRef,
  useEffect,
  useState,
  createElement,
  useMemo,
  Component
} from "react";

let requiredStateStack;
let mutationSubscriptionGroups = new Set();
let oneEffects;
let manyEffects;
let unmountEffects;
let mutationScopes = 0;
const asyncInitial = createAsyncResult(false, false);
const asyncLoading = createAsyncResult(true, false);
const strictComparer = (a, b) => a === b;

/**
 * x(); => create state without default value
 * x(defaultValue) => create state with default value
 * x(component) => create component wrapper
 * x.hoc(options) => create hoc component
 * x.hoc(func) => create hoc component with prop
 * x.compose()
 * x.extend()
 */
function main(...args) {
  // overload (component)
  if (typeof args[0] === "function") return createComponent(args[0]);
  // overload (options, component)
  if (typeof args[1] === "function") return createComponent(args[1], args[0]);

  return createState(args[0], args[1]);
}

function createState(defaultValue, options = {}) {
  // exclude internal usage options
  const { root, parent, prop, ...safeOptions } = options;
  return new State(defaultValue, safeOptions);
}

function createComponent(
  component,
  {
    unmount: unmountOption,
    one: oneOption,
    many: manyOption,
    states: stateOption,
    actions: actionsOption
  } = {}
) {
  const stateEntries = stateOption ? Object.entries(stateOption) : undefined;
  const actionEntries = actionsOption
    ? Object.entries(actionsOption)
    : undefined;

  function Wrapper(props) {
    // noinspection JSConstructorReturnsPrimitive
    return useBinding(() => {
      const actionMap = useMemo(() => {
        if (!actionEntries) return undefined;
        const actions = {};
        actionEntries.forEach(
          entry =>
            (actions[entry[0]] = (...args) =>
              dispatch(entry[1], props, ...args))
        );
      }, []);

      let newProps = props;

      if (stateEntries || oneOption || manyOption || actionMap) {
        newProps = {};
        // map state to props
        stateEntries &&
          stateEntries.forEach(
            entry =>
              (newProps[entry[0]] =
                typeof entry[1] === "function"
                  ? entry[1](props)
                  : entry[1].value)
          );
        oneOption && one(...[].concat(oneOption));
        manyOption &&
          // { many: action }
          (typeof manyOption === "function"
            ? [[manyOption]]
            : // { many: [action, resolver] }
            typeof manyOption[0] === "function"
            ? [manyOption]
            : //
              manyOption
          ).forEach(many);

        // map actions to props
        actionMap && Object.assign(newProps, actionMap);
        // assign original props to new props, that means parent component can overwrite child component prop
        Object.assign(newProps, props);
      }

      unmountOption && unmount(...[].concat(unmountOption));

      return component(newProps);
    }, props);
  }

  return memo(Wrapper);
}

function compose(...functions) {
  if (functions.length === 0) {
    return arg => arg;
  }

  if (functions.length === 1) {
    return functions[0];
  }

  return functions.reduce((a, b) => (...args) => a(b(...args)));
}

function hoc(...callbacks) {
  if (callbacks[0] && typeof callbacks[0] !== "function") {
    if (callbacks[0].styledComponentId) {
      throw new Error("Not support styled component");
    }
    return component => createComponent(component, callbacks[0]);
  }

  return callbacks.reduce(
    (nextHoc, callback) => Component => {
      const MemoComponent = memo(Component);

      return createComponent(props => {
        // callback requires props and Comp, it must return React element
        if (callback.length > 1) {
          return callback(props, MemoComponent);
        }
        let newProps = callback(props);
        if (newProps === false) return null;
        if (!newProps) {
          newProps = props;
        }

        return createElement(MemoComponent, newProps);
      });
    },
    Component => Component
  );
}

function bindClassComponent(component) {
  const originalRender = component.render;
  const originalWillUnmount = component.componentWillUnmount;
  let prevValues;
  let states;
  let lastError;
  const cleanup = () => {
    if (!states) return;
    for (const state of states) {
      state.unsubscribe(checkForUpdates);
    }
  };
  const checkForUpdates = () => {
    try {
      const nextValues = [];
      for (const state of states) {
        nextValues.push(state.__getValue());
      }
      if (!arrayEqual(nextValues, prevValues)) {
        cleanup();
        component.setState({});
      }
    } catch (e) {
      lastError = e;
      component.setState({});
    }
  };

  component.render = () => {
    if (lastError) {
      const e = lastError;
      lastError = undefined;
      throw e;
    }
    const prevRequiredStates = requiredStateStack;
    requiredStateStack = states = new Set();
    try {
      return originalRender();
    } finally {
      requiredStateStack = prevRequiredStates;
      prevValues = [];
      for (const state of states) {
        state.subscribe(checkForUpdates);
        prevValues.push(state.__getValue());
      }
    }
  };

  component.componentWillUnmount = () => {
    cleanup();
    originalWillUnmount && originalWillUnmount();
  };
}

function useBinding(action, props) {
  // do binding for class component
  if (action instanceof Component) {
    return bindClassComponent(action);
  }
  const [, forceRerender] = useState();
  const propsRef = useRef();
  // we use this ref to store current required states
  // this stack will cleanup once component re-render
  const currentRequiredStateStackRef = useRef();
  const prevValuesRef = useRef([]);
  const exceptionRef = useRef();
  const unsubscribesRef = useRef([]);
  const manyEffectArgsRef = useRef([]);
  const cleanup = useCallback(() => {
    unsubscribesRef.current.forEach(unsubscribe => unsubscribe());
    for (const state of currentRequiredStateStackRef.current) {
      if (state.__requireStack === currentRequiredStateStackRef.current) {
        delete state.__requireStack;
      }
    }
    currentRequiredStateStackRef.current.clear();
  }, []);

  const checkForUpdates = useCallback(() => {
    let hasChange = false;

    try {
      let index = 0;
      for (const state of currentRequiredStateStackRef.current) {
        const prevValue = prevValuesRef.current[index];
        const currentValue = state.value;
        if (currentValue !== prevValue) {
          hasChange = true;
          break;
        }
        index++;
      }
    } catch (e) {
      exceptionRef.current = e;
    }

    if (hasChange) {
      cleanup();
      forceRerender({});
    }
  }, [cleanup]);
  const oneEffectCalledRef = useRef(false);
  const oneEffectsRef = useRef([]);
  const manyEffectsRef = useRef([]);
  const unmountEffectsRef = useRef([]);

  if (exceptionRef.current) {
    const ex = exceptionRef.current;
    exceptionRef.current = undefined;
    throw ex;
  }

  propsRef.current = props;
  unmountEffectsRef.current = [];

  if (!currentRequiredStateStackRef.current) {
    // noinspection JSValidateTypes
    currentRequiredStateStackRef.current = new Set();
  } else {
  }

  useEffect(() => cleanup, [cleanup]);

  // process one effects
  useEffect(() => {
    oneEffectCalledRef.current = true;
    for (const effect of oneEffectsRef.current) {
      dispatch(effect, propsRef.current);
    }

    // process unmount effect
    return () => {
      unmountEffectsRef.current.forEach(unmount => unmount(propsRef.current));
    };
  }, []);

  // process many effects
  useEffect(() => {
    const effects = manyEffectsRef.current;
    manyEffectsRef.current = [];
    effects.forEach(([effect, argsResolver], index) => {
      let args = argsResolver
        ? // we can pass literal array as argsResolver
          Array.isArray(argsResolver)
          ? argsResolver
          : argsResolver(props)
        : [];
      if (!Array.isArray(args)) {
        args = [args];
      }
      const prevArgs = manyEffectArgsRef.current[index];
      const effectShouldCallEveryTime =
        typeof prevArgs === "undefined" || !argsResolver;
      if (effectShouldCallEveryTime || !arrayEqual(prevArgs, args)) {
        manyEffectArgsRef.current[index] = args;
        dispatch(effect, ...args);
      }
    });
  });

  // setup stacks
  const prevRequiredStateStack = requiredStateStack;
  requiredStateStack = currentRequiredStateStackRef.current;

  const prevOneEffects = oneEffects;
  if (!oneEffectCalledRef.current) {
    oneEffects = oneEffectsRef.current;
  }

  const prevManyEffects = manyEffects;
  manyEffects = manyEffectsRef.current;

  const prevUnmountEffects = unmountEffects;
  unmountEffects = unmountEffectsRef.current;

  try {
    return action(propsRef.current);
  } finally {
    // restore stacks
    requiredStateStack = prevRequiredStateStack;
    oneEffects = prevOneEffects;
    manyEffects = prevManyEffects;
    unmountEffects = prevUnmountEffects;

    unsubscribesRef.current = [];
    prevValuesRef.current = [];

    for (const state of currentRequiredStateStackRef.current) {
      unsubscribesRef.current.push(state.subscribe(checkForUpdates));
      prevValuesRef.current.push(state.value);
    }
  }
}

function State(
  defaultValue,
  { name, parent, root, prop, compare = strictComparer } = {}
) {
  this.name = name;
  this.__value = defaultValue;
  this.__subStates = new Map();
  this.__root = root || this;
  this.__prop = prop;
  this.__parent = parent;
  this.__compare = compare;
  this.__subscriptions = root ? root.__subscriptions : new Set();
  this.__chunkSize = undefined;
  this.__chunks = undefined;
  this.__computingToken = undefined;
  this.__isComputing = false;
  this.__async = false;
  this.__shouldChunksUpdate = false;

  this.__getValue = tryEval => {
    if (this.__parent) {
      // try to get value from its parent
      const parentValue = this.__parent.__getValue(tryEval);
      return tryEval &&
        (typeof parentValue === "undefined" || parentValue === null)
        ? undefined
        : parentValue instanceof State
        ? parentValue.value[this.__prop]
        : parentValue[this.__prop];
    }

    return this.__value;
  };

  this.__setValue = value => {
    if (this.__parent) {
      const clonedParentValue = clone(this.__parent.value);
      clonedParentValue[this.__prop] = value;
      this.__parent.__setValue(clonedParentValue);
    } else {
      this.__value = value;
    }
  };

  this.__getSubState = prop => {
    if (this.__value && this.__value[prop] instanceof State)
      return this.__value[prop];

    let subState = this.__subStates.get(prop);
    if (!subState) {
      this.__subStates.set(
        prop,
        (subState = new State(undefined, {
          root: this.__root,
          parent: this,
          prop
        }))
      );
    }
    return subState;
  };
}

Object.defineProperty(State.prototype, "value", {
  get() {
    if (requiredStateStack && this.__requireStack !== requiredStateStack) {
      this.__requireStack = requiredStateStack;
      requiredStateStack.add(this);
    }

    if (this.computer) {
      this.computer.start();
    }

    return this.__getValue();
  },

  set(value) {
    const currentValue = this.__getValue(true);
    if (this.__compare(value, currentValue)) return;

    this.__setValue(value);

    if (mutationScopes) {
      mutationSubscriptionGroups.add(this.__subscriptions);
    } else {
      notify(this.__subscriptions, value);
    }
  }
});

Object.defineProperty(State.prototype, "inputProps", {
  get() {
    return {
      value: this.value,
      onChange: this.handleChange
    };
  }
});

Object.defineProperty(State.prototype, "chunks", {
  get() {
    if (typeof this.__chunkSize === "undefined") {
      throw new Error("No chunk size specified");
    }

    if (requiredStateStack && this.__requireStack !== requiredStateStack) {
      this.__requireStack = requiredStateStack;
      requiredStateStack.add(this);
    }

    if (this.__shouldChunksUpdate) {
      let start = 0;
      const values = this.__getValue();
      const prevChunks = this.__chunks || [];
      const chunks = [];
      mutate(() => {
        while (start < values.length) {
          const chunk =
            prevChunks.shift() || new State(undefined, { compare: arrayEqual });
          const end = start + this.__chunkSize;
          chunk.__start = start;
          chunk.value = values.slice(start, end);
          chunks.push(chunk);
          start = end;
        }
      });
      this.__chunks = chunks;
      this.__shouldChunksUpdate = false;
    }
    return this.__chunks;
  }
});

Object.assign(State.prototype, {
  chunk(size) {
    size = parseInt(size, 10) || 1;

    if (size < 2) {
      throw new Error("Invalid chunk size");
    }

    if (this.__chunkSize !== size) {
      if (!this.__updateChunks) {
        this.__updateChunks = () => {
          this.__shouldChunksUpdate = true;
        };
        this.__root.subscribe(this.__updateChunks);
      }

      this.__chunkSize = size;
      this.__shouldChunksUpdate = true;
      notify(this.__subscriptions);
    }

    return this;
  },
  prop(strings) {
    const path = Array.isArray(strings) ? strings[0] : strings;
    return path
      .toString()
      .split(".")
      .reduce((parent, prop) => parent.__getSubState(prop), this);
  },

  get(path) {
    if (!path) return this.value;
    return this.prop(path).value;
  },

  subscribe(subscription, { debounce = false } = {}) {
    subscription = createDebouncedFunction(subscription, debounce);
    this.__subscriptions.add(subscription);
    return () => this.__subscriptions.delete(subscription);
  },

  unsubscribe(subscription) {
    this.__subscriptions.delete(subscription);
  },

  tap(action) {
    action(this, this.__getValue());
    return this;
  },

  mutate(action, needClone) {
    const target = needClone
      ? clone(this.__getValue(true))
      : this.__getValue(true);
    const result = action(target);
    this.value = needClone ? target : result;
    return this;
  },

  compute(states, computer, { onError, lazy, ...options } = {}) {
    if (this.computer) {
      this.computer.unsubscribe();
      delete this.computer;
    }

    const compute = () => {
      // prevent recursive calling
      if (this.__isComputing) return;
      this.__isComputing = true;
      // create token for each computing session
      this.__computingToken = {};
      try {
        const result = computer();
        // async result
        if (result && result.then) {
          if (this.__async) {
            this.value = asyncLoading;
          }
          // save current token for late comparison
          const token = this.__computingToken;
          result.then(
            data => {
              // if saved token is diff with current token
              // that means there is a new computing call since last time
              if (token !== this.__computingToken) {
                return;
              }
              if (this.__async) {
                this.value = createAsyncResult(false, true, data);
              } else {
                this.value = data;
              }
            },
            error => {
              if (this.__async) {
                this.value = createAsyncResult(false, true, undefined, error);
              }
              onError && onError(error);
            }
          );
        } else {
          this.value = result;
        }
      } catch (e) {
        onError && onError(e);
      } finally {
        this.__isComputing = false;
      }
    };

    subscribe(states, compute, options);

    if (lazy) {
      this.computer = {
        start() {
          if (this.started) return;
          this.started = true;
          setTimeout(compute, 0);
        },
        unsubscribe() {
          states.forEach(state => state.unsubscribe(compute));
        }
      };
    } else {
      compute();
    }

    return this;
  },

  async(promise) {
    this.__async = true;

    if (!arguments.length) {
      // mark state as async state
      return this.mutate(value =>
        typeof value === "undefined"
          ? asyncInitial
          : createAsyncResult(false, false, value)
      );
    }

    if (promise && !promise.then) {
      const { done, loading, success, error, fallback } = promise;
      const value = this.value || {};
      if (value.done && typeof done !== "undefined") {
        return typeof done === "function"
          ? done(value.data, value.error)
          : done;
      }

      if (value.loading && typeof loading !== "undefined") {
        return typeof loading === "function" ? loading() : loading;
      }

      if (!value.error && value.done && typeof success !== "undefined") {
        return typeof success === "function" ? success(value.data) : success;
      }

      if (value.error && typeof error !== "undefined") {
        return typeof error === "function" ? error(value.error) : error;
      }

      return typeof fallback === "function"
        ? fallback()
        : typeof fallback === "undefined"
        ? null
        : fallback;
    }

    const token = (this.__currentPromiseToken = {});
    let done = false;

    promise.then(
      data => {
        done = true;
        token === this.__currentPromiseToken &&
          (this.value = createAsyncResult(false, true, data));
      },
      error => {
        done = true;
        token === this.__currentPromiseToken &&
          (this.value = createAsyncResult(false, true, undefined, error));
      }
    );

    !done && (this.value = asyncLoading);
    return this;
  },

  batch(modifiers) {
    mutate(() => {
      modifiers.forEach(modifier => {
        if (typeof modifier === "function") {
          modifier = modifier(this.__getValue());
        }
        const [method, ...args] = Array.isArray(modifier)
          ? modifier
          : [modifier];
        this[method](...args);
      });
    });
    return this;
  }
});

function arrayEqual(a, b) {
  if (!a || b) return false;
  if (!b || a) return false;
  return a.length === b.length && a.every((i, index) => i === b[index]);
}

function notify(subscriptions, ...args) {
  for (const subscription of subscriptions) {
    subscription(...args);
  }
}

function mutate(functor) {
  mutationScopes++;
  try {
    return functor();
  } finally {
    mutationScopes--;
    if (!mutationScopes) {
      const groups = mutationSubscriptionGroups;
      mutationSubscriptionGroups = new Set();
      const subscriptions = new Set();
      for (const group of groups) {
        for (const subscription of group) {
          subscriptions.add(subscription);
        }
      }
      notify(subscriptions);
    }
  }
}

function createAsyncResult(loading, done, data, error) {
  return {
    loading,
    done,
    data,
    error
  };
}

function dispatch(action, ...args) {
  if (action.then) {
    return action.then(
      payload => {
        args[0] && dispatch(args[0], payload);
        return payload;
      },
      error => {
        args[1] && dispatch(args[1], error);
        return error;
      }
    );
  }

  if (Array.isArray(action)) {
    return dispatch(...action, ...args);
  }
  let result = undefined;
  mutate(() => {
    result = action(...args);
  });

  return result;
}

function clone(value) {
  if (Array.isArray(value)) return value.slice(0);
  return Object.assign({}, value);
}

function extend(...prototypes) {
  Object.assign(State.prototype, ...prototypes);
}

function getValues(stateMap) {
  const result = {};

  Object.entries(stateMap).forEach(entry => {
    result[entry[0]] = entry[1].value;
  });

  return result;
}

function setValues(stateMap, data = {}) {
  mutate(() => {
    Object.entries(data).forEach(entry => {
      if (entry[0] in stateMap) {
        stateMap[0].value = entry[1];
      }
    });
  });
}

function unmount(...callback) {
  unmountEffects && unmountEffects.push(...callback);
}

function one(...actions) {
  oneEffects && oneEffects.push(...actions);
}

function many(action, argsResolver) {
  manyEffects.push([action, argsResolver]);
}

function subscribe(
  states,
  subscription,
  { debounce = false, ...options } = {}
) {
  subscription = createDebouncedFunction(subscription, debounce);
  const unsubscribes = states.map(state =>
    state.subscribe(subscription, options)
  );
  return () => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  };
}

// element helpers
Object.assign(State.prototype, {
  handleChange(e) {
    this.value = e.target.value;
  }
});

/**
 * array helpers
 */
extend({
  first(defaultValue) {
    const result = this.__getValue()[0];
    if (typeof result === "undefined") return defaultValue;
    return result;
  },
  last(defaultValue) {
    const array = this.__getValue();
    const result = array[array.length - 1];
    if (typeof result === "undefined") return defaultValue;
    return result;
  },
  push(...args) {
    if (!args.length) return this;
    return this.mutate(array => array.push(...args), true);
  },
  pop() {
    return this.mutate(array => array.pop(), true);
  },
  shift() {
    return this.mutate(array => array.shift(), true);
  },
  unshift(...args) {
    if (!args.length) return this;
    return this.mutate(array => array.unshift(...args), true);
  },
  splice(...args) {
    let result = undefined;
    this.mutate(array => {
      result = array.splice(...args);
      return array;
    }, true);
    return result;
  },
  filter(predicate) {
    return this.mutate(array => array.filter(predicate));
  },
  /**
   * orderBy(prop, desc)
   * orderBy({
   *   prop1: true // desc
   *   prop2: false // asc
   * })
   *
   * orderBy([func, true], [func, false])
   */
  orderBy(...args) {
    // { prop1: boolean, prop2: false }
    if (!Array.isArray(args[0])) {
      if (typeof args[0] === "object") {
        args = Object.entries(args[0]);
      } else {
        args = [[args[0], args[1]]];
      }
    }
    // normalize args
    args = args.map(([prop, desc]) => [
      typeof prop === "function" ? prop : obj => obj[prop],
      desc
    ]);

    return this.mutate(
      array =>
        array.sort((a, b) => {
          for (const [func, desc] of args) {
            const aValue = func(a);
            const bValue = func(b);
            if (aValue === bValue) {
              continue;
            }
            if (aValue > bValue) {
              return desc ? -1 : 1;
            }
            return desc ? 1 : -1;
          }
        }),
      true
    );
  },
  sort(sorter) {
    return this.mutate(array => array.sort(sorter), true);
  },
  concat(...args) {
    return this.mutate(array => array.concat(...args));
  },
  fill(...values) {
    return this.mutate(array => array.fill(...values), true);
  },
  flat(...args) {
    return this.mutate(array => array.flat(...args));
  },
  map(...args) {
    return this.mutate(array => array.map(...args));
  },
  reverse(...args) {
    return this.mutate(array => array.reverse(...args), true);
  },
  slice(...args) {
    return this.mutate(array => array.slice(...args));
  },
  exclude(...values) {
    if (!values.length) return this;
    const temp = [];
    const array = this.__getValue();
    for (const item of array) {
      if (!values.includes(item)) {
        temp.push(item);
      }
    }
    if (temp.length !== array.length) {
      return this.set(temp);
    }
    return this;
  },
  remove(...indexes) {
    indexes.sort();
    if (!indexes.length) return this;
    let array = this.__getValue();
    if (indexes[indexes.length - 1] >= array.length) return this;
    array = array.slice(0);
    while (indexes.length) {
      const index = indexes.pop();
      if (index >= array.length) break;
      array.splice(index, 1);
    }
    this.value = array;
    return this;
  },
  filterMap(predicate, mapper) {
    return this.mutate(array => array.filter(predicate).map(mapper));
  },
  swap(sourceIndex, destIndex) {
    return this.mutate(array => {
      const temp = array[sourceIndex];
      array[sourceIndex] = array[destIndex];
      array[destIndex] = temp;
    }, true);
  }
});

// object helpers
extend({
  def(prop, value) {
    if (arguments.length < 2) {
      return this.mutate(current =>
        typeof current === "undefined" ? value : current
      );
    }
    return this.prop(prop).def(value);
  },
  toggle(...props) {
    if (props.length) {
      return this.mutate(
        obj => props.forEach(prop => (obj[prop] = !obj[prop])),
        true
      );
    }
    return this.mutate(value => !value);
  },
  unset(...props) {
    if (!props.length) return;
    return this.mutate(obj => {
      props.forEach(prop => delete obj[prop]);
    }, true);
  },
  set(prop, value) {
    if (arguments.length < 2) {
      this.value = prop;
      return this;
    }
    this.prop(prop).value = value;
    return this;
  },
  assign(...objs) {
    if (!objs.length) return;
    return this.mutate(obj => Object.assign({}, obj, ...objs));
  },
  merge() {}
});

const modifyDate = (
  date,
  year = 0,
  month = 0,
  day = 0,
  hour = 0,
  minute = 0,
  second = 0,
  milli = 0
) =>
  new Date(
    date.getFullYear() + year,
    date.getMonth() + month,
    date.getDate() + day,
    date.getHours() + hour,
    date.getMinutes() + minute,
    date.getSeconds() + second,
    date.getMilliseconds() + milli
  );

const dateModifiers = {
  month(date, value) {
    return modifyDate(date, 0, value);
  },
  year(date, value) {
    return modifyDate(date, value);
  },
  day(date, value) {
    return modifyDate(date, 0, 0, value);
  },
  week(date, value) {
    return modifyDate(date, 0, 0, value * 7);
  },
  hour(date, value) {
    return modifyDate(date, 0, 0, 0, value);
  },
  minute(date, value) {
    return modifyDate(date, 0, 0, 0, 0, value);
  },
  second(date, value) {
    return modifyDate(date, 0, 0, 0, 0, 0, value);
  },
  milli(date, value) {
    return modifyDate(date, 0, 0, 0, 0, 0, 0, value);
  }
};

// add shortcuts
dateModifiers.D = dateModifiers.day;
dateModifiers.M = dateModifiers.month;
dateModifiers.Y = dateModifiers.year;
dateModifiers.W = dateModifiers.week;
dateModifiers.h = dateModifiers.hour;
dateModifiers.m = dateModifiers.minute;
dateModifiers.s = dateModifiers.second;
dateModifiers.ms = dateModifiers.milli;

// value helpers
extend({
  add(...args) {
    return this.mutate(current => {
      // support tuple [value, duration]
      if (Array.isArray(args[0])) {
        args = args.flat();
      }
      if (current instanceof Date) {
        const modify = (date, value, duration) => {
          if (duration in dateModifiers) {
            return dateModifiers[duration](current, value);
          }
          throw new Error("Invalid date duration " + duration);
        };

        while (args.length) {
          current = modify(current, args.shift(), args.shift());
        }

        return current;
      } else {
        return current + args[0];
      }
    });
  },
  mul(value) {
    return this.mutate(current => current * value);
  },
  div(value) {
    return this.mutate(current => current / value);
  }
});

// string helpers
extend({
  replace(...args) {
    return this.mutate(current => current.replace(...args));
  },
  substr(...args) {
    return this.mutate(current => current.substr(...args));
  },
  substring(...args) {
    return this.mutate(current => current.substring(...args));
  },
  trim(...args) {
    return this.mutate(current => current.trim(...args));
  },
  upper() {
    return this.mutate(current => current.toUpperCase());
  },
  lower() {
    return this.mutate(current => current.toLowerCase());
  }
});

function createDebouncedFunction(func, interval = 20) {
  if (interval === false) return func;
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(func, interval, ...args);
  };
}

const chunkRenderer = memo(({ chunk, renderer }) => {
  return chunk.value.map((item, index) => renderer(item, chunk.start + index));
});

const listRenderer = memo(({ state, renderer }) => {
  return state.chunks.map(chunk =>
    createElement(chunkRenderer, { chunk, renderer })
  );
});

function renderList(state, renderer) {
  return createElement(listRenderer, { state, renderer });
}

function snapshot(...states) {
  const snapshots = new Map();
  states.forEach(state =>
    snapshots.set(state, {
      __value: state.__value
    })
  );

  return () => {
    states.forEach(state => (state.__value = snapshots.get(state).__value));
  };
}

Object.assign(main, {
  hoc,
  compose,
  extend,
  mutate,
  clone,
  subscribe,
  get: getValues,
  set: setValues,
  one,
  once: one,
  many,
  multiple: many,
  unmount,
  bind: useBinding,
  dispatch,
  call: dispatch,
  list: renderList,
  snapshot
});

export default main;
