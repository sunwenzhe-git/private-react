import createElement from "./createElement";
import render from "./render";
import updateDom from "./updateDom";

let currentRoot = null;
let workInprogressRoot = null;
let workInprogressFiber = null;
let nextUnitOfWork = null;
let deletions = null;

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
  if (!nextUnitOfWork && workInprogressRoot) {
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
  /**函数式组件有两点不同，如下：
      函数式组件没有 dom 节点 ？
      他的 children 属性 不在 props 上，而是 他的返回值
  */
  isFunctionComponent && updateFunctionComponent(fiber);

  if (!fiber.dom) {
    // 创建一个 dom 元素，挂载到 fiber 的 dom 属性
    fiber.dom = createElement(fiber);
  }

  if (fiber.parent) {
    // 如果有父节点，将 dom 添加到父元素的 dom 上
    fiber.parent.dom.appendChild(fiber.dom);
  }
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);
  let index = 0;

  // 保存上一个 sibling fiber 结构
  let prevSibling = null;

  while (index < elements.length) {
    const element = elements[index];
    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    };

    // 第一个子元素作为 child，其余的子元素作为 sibling
    if (index === 0) {
      fiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;

    // step1 如果 有 child fiber ，则返回 child
    if (fiber.child) {
      return fiber.child;
    }

    let nextFiber = fiber;

    while (nextFiber) {
      // step2 如果有sibling fiber ，则返回 sibling
      if (nextFiber.sibling) {
        return nextFiber.sibling;
      }

      // step3 ，否则返回他的 parent fiber
      nextFiber = nextFiber.parent;
    }
  }
}

function updateFunctionComponent(fiber) {
  workInprogressFiber = fiber;
  workInprogressFiber.hooks = [];
  // 执行函数式组件获取到 children
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}

/**
 * @description: 执行reconcile算法
 * @param {*} workInprogressFiber
 * @param {*} elements
 * @return {*}
 */
function reconcileChildren(workInprogressFiber, elements) {
  let index = 0;
  let oldFiber =
    workInprogressFiber.alternate && workInprogressFiber.alternate.child;
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
        parent: workInprogressFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: workInprogressFiber,
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
      workInprogressFiber.child = newFiber;
    } else if (element) {
      prevSibling.sibling = newFiber;
    }
    prevSibling = newFiber;
  }
}

function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(workInprogressRoot.child);
  // 渲染完毕后，workInProgress Fiber 树变为 current Fiber 树
  currentRoot = workInprogressRoot;
  workInprogressRoot = null;
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

const ReactDOM = {
  render: render,
};
const react = {
  createElement: createElement,
};
export { react, ReactDOM };

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
