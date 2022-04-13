/**
 * @description: 第一次分享时的render方法
 * @param {*} element
 * @param {*} container
 * @return {*}
 */
export default function render(element, container) {
  const dom =
    element.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type);

  // 排除 特殊属性 "children"
  const isProperty = (key) => key !== "children";

  // 将元素属性 一一 写入 dom 节点上
  Object.keys(element.props)
    .filter(isProperty)
    .forEach((name) => {
      // 事件
      if (/on\w+/.test(name)) {
        dom[name.toLowerCase()] = element.props[name];
      }
      dom[name] = element.props[name];
    });

  // 遍历递归 将 子元素 一个一个 都 附到 真实的 dom 节点上
  element.props.children.forEach((child) => render(child, dom));

  // 最后挂载到 指定的 dom 节点容器上
  container.appendChild(dom);
}
