import render from "./render";
/** 首先实现源码运行环境  start */
let isMount = true; // 模拟组件生命周期，在mount时和update时调用的方法都是不一样的 3
let workInprogressHook = null; // 工作的任务链表，指针指向当前处理的hook 6

// 在react中，每个组件有个对应的fiber节点（可以理解为虚拟DOM），用于保存组件相关信息，简化起见只写了App这一个fiber 1
const fiber = {
  type: "FunctionComponent", // 该组件的类型
  memoizedState: null, // 因为很多hooks保存在一个变量上，并且调用顺序一致，所以保存的是一个单链表，保存的是每一个hook对应的数据，我们还需要一个指针来指向当前工作的hook 5
  stateNode: null, // 保存着App本身
  // ... 这里写了部分属性
};

// 模拟首次render 4 首次调用之后isMount为false
requestIdleCallback(() => {
  if (window.app && isMount) {
    const container = document.getElementById("root");
    fiber.stateNode = window.app;
    const app = fiber.stateNode(); // 对应render阶段
    render(app, container);
    isMount = false; // 首次调用之后变为update模式，源码中hooks调用时，mount阶段和update阶段调用的是两个方法
  }
});
// reconciler阶段的逻辑
function todoReconciler() {
  // todo reconciler阶段的逻辑
  const container = document.getElementById("root");
  container.innerHTML = "";
  const app = fiber.stateNode(); // 对应render阶段
  render(app, container);
}

/** 阅读顺序四  start */
// 我们需要一种方式让我们的迷你版react运行起来，需要一个调度的方法，触发render；2
// 调度-->把不同优先级的更新进行排序
function schedule() {
  workInprogressHook = fiber.memoizedState; // 这部分是把workInprogressHook运行的指针重新指向第一个memoizedState，初始化复位一下 7
  todoReconciler();
}
/** 实现源码运行环境  end */

/** 阅读顺序四  end */
// 计算一个新的状态，并返回一个改变当前状态的方法  return [state, setState]
/** 阅读顺序一  start */
function useState(initialState) {
  // 我们需要获取到当前的useState指向哪一个hook
  let hook;
  // 在mount时每一个useState都会调用这个方法创建一个hook，通过next指针把所有useState关联起来形成一个链表
  if (isMount) {
    // 首次渲染的时候fiber.memoizedState的指针指向null ，因此我们需要创建一个hook
    hook = {
      memoizedState:
        typeof initialState === "function" ? initialState() : initialState, // 链表的头节点是我们传入的参数
      next: null,
      queue: {
        // 保存的是改变的状态，可能一个setState调用多次，所以用链表保存，
        pending: null, // 当前头节点指向null
      },
    };
    // 如果指针指向null，证明当前fiber.memoizedState对象里面没有hook节点
    if (fiber.memoizedState === null) {
      fiber.memoizedState = hook; // 那么就把我们创建的hook当作头节点
      workInprogressHook = hook; // 当前处理的hook就是我们定义的hook，workInprogressHook在这边被初始化为一个链表
    } else {
      // 如果不是第一个调用用的hook，就把当前hook存到我们的工作任务链表内
      workInprogressHook.next = hook;
      // 此时workInprogressHook的结构是这样的
      /*workInprogressHook={
        memoizedState: initialState,
        next: {
            memoizedState: initialState,
            next: {...},
            queue: {
              pending: null,
            },
          }, 
        queue: {
          pending: null,
        },
      }*/
    }
  } else {
    // 此时update阶段我们已经有一个hook的链表，把工作链表赋值给hook，然后让当前的workInprogressHook指向下一个工作任务
    hook = workInprogressHook;
    workInprogressHook = workInprogressHook.next; // 这步就相当于清除头节点，把最外层对象干掉，因为执行完了就不再保留当前任务，所以指向下一个hook
  }
  /** 阅读顺序一  end */

  /** 阅读顺序三 通过调用setState来计算新的状态 start */
  // 当前任务的基本状态，如果是第一次的时候，baseState就是我们传的参数
  let baseState = hook.memoizedState;

  // 代表有新的update被执行
  if (hook.queue.pending) {
    // 找到第一个的update
    let firstUpdate = hook.queue.pending.next;
    // 遍历当前链表
    do {
      // 取出action基于action计算新的state
      const action = firstUpdate.action;
      // while是先判断条件再执行循环体，do while是先执行循环体再判断条件
      if (typeof action === "function") {
        baseState = action(baseState); // 此时是调用完一次setState后的值了
      } else {
        baseState = action;
      }
      firstUpdate = firstUpdate.next; // 当前状态更新完，把指针指向下一个setState，用于setState的链式调用，比如setNumber(1);setNumber(2);
    } while (firstUpdate !== hook.queue.pending.next); // 遍历完整个环状链表
    // 将链表清空
    hook.queue.pending = null;
  }
  // 更改当前状态
  hook.memoizedState = baseState;
  return [hook.memoizedState, dispatchAction.bind(null, hook.queue)];
  /** 阅读顺序三  end */
}

// 就是setState方法，源码中的useState实际上调用的useReducer，只不过useState会给useReducer一个默认的reducer，而调用useReducer需要我们自己创建
/** 阅读顺序二 实现setState start */
/**
 * @description:
 * @param {*} queue 调用的都是dispatchAction，我们怎么知道当前调用的dispatchAction对应的是哪个useState呢，所以需要将hook对应的数据（改变的新的状态）传给dispatchAction
 * @param {*} action setState时传入的新状态
 * @return {*}
 */
function dispatchAction(queue, action) {
  // 考虑到优先级的问题所以update这边是个环状列表，比如点击的优先级高于其它
  const update = {
    action, // 就是我们自己写的updateNum的参数
    next: null,
  };
  // 代表当前没有能触发的更新，那么我们创建的update就是将要触发的第一个更新
  if (queue.pending === null) {
    // 自己指向自己，形成一个环状链表  u0->u0->u0
    update.next = update;
  } else {
    // 把我们新创建的这个update插入到已经存在的环状链表中 u1->u0->u1  u1是当前创建的这个update
    // 插入链表的操作queue.pending是最后一个update，所以他的next指向第一个update

    // 这一步是完成 u1->u0
    update.next = queue.pending.next;

    // u0->u1
    queue.pending.next = update;

    // 这样就构成了一个环状链表
  }
  // 每次这个方法创建的update都是最新的update也就是这个环状链表的最后一个update

  queue.pending = update;
  /** 阅读顺序二  end */

  schedule();
}
export { useState };
