import {
  memo,
  useCallback,
  useRef,
  useEffect,
  useState,
  createElement,
  useMemo
} from "react";

let requiredStateStack;
let mutationSubscriptions = new Set();
let oneEffects;
let manyEffects;
let unmountEffects;
let mutationScopes = 0;
const asyncInitial = {
  done: false,
  loading: false,
  data: undefined,
  error: undefined
};
const asyncLoading = {
  done: false,
  loading: true,
  data: undefined,
  error: undefined
};
const defaultComparer = (a, b) => a === b;

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

function createState(defaultValue, options) {
  return new State(defaultValue, options);
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
    const actionMap = useMemo(() => {
      if (!actionEntries) return undefined;
      const actions = {};
      actionEntries.forEach(
        entry =>
          (actions[entry[0]] = (...args) =>
            mutate(() => entry[1](propsRef.current, ...args)))
      );
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
        effect(propsRef.current);
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
      effects.forEach(([action, argsResolver], index) => {
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
          action(...args);
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
      let newProps = props;

      if (stateEntries || oneOption || manyOption || actionMap) {
        newProps = {};
        // map state to props
        stateEntries &&
          stateEntries.forEach(
            entry =>
              (newProps[entry[0]] =
                typeof entry[1] === "function"
                  ? entry[1](propsRef.current)
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
  if (
    callbacks[0] &&
    typeof callbacks[0] !== "function" &&
    !callbacks[0].styledComponentId
  ) {
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

/**
 *
 */
class State {
  constructor(
    defaultValue,
    { parent, root, prop, compare = defaultComparer } = {}
  ) {
    this.__value = defaultValue;
    this.__subStates = new Map();
    this.__root = root;
    this.__prop = prop;
    this.__parent = parent;
    this.__compare = compare;
    this.__subscriptions = root ? root.__subscriptions : new Set();

    this.__getValue = tryEval => {
      if (this.__parent) {
        // try to get value from its parent
        const parentValue = this.__parent.__getValue(tryEval);
        return tryEval &&
          (typeof parentValue === "undefined" || parentValue === null)
          ? undefined
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
      let subState = this.__subStates.get(prop);
      if (!subState) {
        this.__subStates.set(
          prop,
          (subState = new State(undefined, {
            root: this.__root || this,
            parent: this,
            prop
          }))
        );
      }
      return subState;
    };
  }

  prop(strings) {
    const path = Array.isArray(strings) ? strings[0] : strings;
    return path
      .toString()
      .split(".")
      .reduce((parent, prop) => parent.__getSubState(prop), this);
  }

  get(path) {
    if (!path) return this.value;
    return this.prop(path).value;
  }

  get value() {
    if (requiredStateStack && this.__requireStack !== requiredStateStack) {
      this.__requireStack = requiredStateStack;
      requiredStateStack.add(this);
    }
    return this.__getValue();
  }

  set value(value) {
    const currentValue = this.__getValue(true);
    if (this.__compare(value, currentValue)) return;

    this.__setValue(value);

    if (mutationScopes) {
      for (const subscription of this.__subscriptions) {
        mutationSubscriptions.add(subscription);
      }
    } else {
      notify(this.__subscriptions, value);
    }
  }

  subscribe(subscription, { debounce = false } = {}) {
    subscription = createDebouncedFunction(subscription, debounce);
    this.__subscriptions.add(subscription);
    return () => this.__subscriptions.delete(subscription);
  }

  unsubscribe(subscription) {
    this.__subscriptions.delete(subscription);
  }

  tap(action) {
    action(this, this.__getValue());
    return this;
  }

  mutate(action, needClone) {
    const target = needClone
      ? clone(this.__getValue(true))
      : this.__getValue(true);
    const result = action(target);
    this.value = needClone ? target : result;
    return this;
  }

  compute(states, computer, { onError, ...options } = {}) {
    const compute = () => {
      // prevent recursive calling
      if (this.__isComputing) return;
      this.__isComputing = true;
      // create token for each computing session
      this.__computingToken = {};
      try {
        const result = computer(...states.map(state => state.__getValue()));
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
                this.value = {
                  loading: false,
                  done: true,
                  data,
                  error: undefined
                };
              } else {
                this.value = data;
              }
            },
            error => {
              if (this.__async) {
                this.value = {
                  loading: false,
                  done: true,
                  data,
                  error
                };
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

    compute();

    return this;
  }

  async(promise) {
    if (!arguments.length) {
      // mark state as async state
      this.__async = true;
      return this.mutate(value =>
        typeof value === "undefined"
          ? asyncInitial
          : { loading: false, done: false, data: value, error: undefined }
      );
    }

    const token = (this.__currentPromiseToken = {});
    let done = false;

    promise.then(
      data => {
        done = true;
        token === this.__currentPromiseToken &&
          (this.value = {
            loading: false,
            done,
            data,
            error: undefined
          });
      },
      error => {
        done = true;
        token === this.__currentPromiseToken &&
          (this.value = {
            loading: false,
            done,
            error,
            data: undefined
          });
      }
    );

    !done && (this.value = asyncLoading);
    return this;
  }
}

function arrayEqual(a, b) {
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
      const subscriptions = mutationSubscriptions;
      mutationSubscriptions = new Set();
      notify(subscriptions);
    }
  }
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
    stateMap[entry[0]] = entry[1].value;
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
    let result = undefined;
    this.mutate(array => {
      result = array.pop();
      return array;
    }, true);
    return result;
  },
  shift() {
    let result = undefined;
    this.mutate(array => {
      result = array.shift();
      return array;
    }, true);
    return result;
  },
  unshift(...args) {
    if (!args.length) return this;
    return this.mutate(array => array.push(...args), true);
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
  reduce(...args) {
    return this.mutate(array => array.reduce(...args));
  },
  reduceRight(...args) {
    return this.mutate(array => array.reduceRight(...args));
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
  }
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

// value helpers
extend({
  add(value, duration, ...otherDateModify) {
    return this.mutate(current => {
      if (current instanceof Date) {
        const modify = (date, value, duration) => {
          if (duration in dateModifiers) {
            return dateModifiers[duration](current, value);
          }
          throw new Error("Invalid date duration " + duration);
        };
        otherDateModify.unshift(value, duration);

        while (otherDateModify.length) {
          current = modify(
            current,
            otherDateModify.shift(),
            otherDateModify.shift()
          );
        }

        return current;
      } else {
        return current + value;
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
  split(...args) {
    return this.mutate(current => current.split(...args));
  },
  trim(...args) {
    return this.mutate(current => current.trim(...args));
  },
  upper(...args) {
    return this.mutate(current => current.upper(...args));
  },
  lower(...args) {
    return this.mutate(current => current.lower(...args));
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
  many,
  unmount
});

export default main;