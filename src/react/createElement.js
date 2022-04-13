/**
 * @description: createElement方法，babel取的是react.createElement
 * @param {*} param1
 * @return {*}
 */
export default function createElement(type, props, ...children) {
  /**
   * @description: 为文本节点添加类型
   * @param {*} text
   * @return {*}
   */
  function createTextElement(text) {
    return {
      type: "TEXT_ELEMENT",
      props: {
        nodeValue: text,
        children: [],
      },
    };
  }
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  };
}
