import updateDom from "./updateDom";
import createElement from "./createElement";

let currentRoot = null;
// fiber树
let wipRoot = null;
let deletions = null;

// 下一个工作单元
let nextUnitOfWork = null;

// mount阶段首次渲染调用render，构造出fiber树，此时下一个工作单元就是我们当前构造出的fiber
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

// 并发模式的工作执行
function workLoopSync(deadline) {
  // 是否要暂停
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    // 执行 一个工作单元 并返回  下一个工作单元
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  // 所有工作单元都完成Reconciler阶段，我们一并进行提交操作，commitRoot 里进行所有元素往 dom 树上添加的动作
  if (!nextUnitOfWork && wipRoot) {
    console.log(wipRoot, "wipRoot");
    commitRoot();
  }
  requestIdleCallback(workLoopSync);
}

// 会在浏览器空闲时运行，一帧16ms，其中10ms浏览器运行需要，我们react并发模式的事件片为每帧5ms
requestIdleCallback(workLoopSync);
/**
 * @description: 执行工作并返回下一个工作单元
 * @param {*} fiber
 * @return {*}
 */
function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}

let wipFiber = null;
// 保存当前执行 hook 的索引，区分每次执行是哪个 hook
let hookIndex = null;

/**
 * @description: 更新function component
 * @param {*} fiber
 * @return {*}
 */
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];
  // 执行函数式组件获取到 children
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}

function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  const actions = oldHook ? oldHook.queue : [];
  actions.forEach((action) => {
    hook.state = action(hook.state);
  });

  const setState = (action) => {
    hook.queue.push(action);
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}

/**
 * @description: 执行reconcile算法
 * @param {*} workInprogressFiber
 * @param {*} elements
 * @return {*}
 */
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    const sameType = oldFiber && element && element.type == oldFiber.type;

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (element) {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

const ReactDOM = {
  render: render,
};
const react = {
  createElement: createElement,
};
export { ReactDOM, react, useState };

/**
 * @description: 新的树需要删除节点时调用的方法
 * @param {*} fiber
 * @param {*} domParent
 * @return {*}
 */
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props.children);
}

function createDom(fiber) {
  const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);

  return dom;
}

function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  // 渲染完毕后，workInProgress Fiber 树变为 current Fiber 树
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }

  let domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}
