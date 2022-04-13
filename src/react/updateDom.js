/**
 * @description: // 更新 dom 的属性(新增新属性和移除旧属性)及事件的添加和移除处理
 * @param {*} dom
 * @param {*} prevProps
 * @param {*} nextProps
 * @return {*}
 */
// 事件属性
const isEvent = (key) => key.startsWith("on");
// 除 事件属性 和 特殊属性 children 外的属性
const isProperty = (key) => key !== "children" && !isEvent(key);
// 是否为新增属性
const isNew = (prev, next) => (key) => prev[key] !== next[key];
// 是否要移除属性
const isGone = (prev, next) => (key) => !(key in next);
export default function updateDom(dom, prevProps, nextProps) {
  // 移除旧事件
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // 移除旧属性
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = "";
    });

  // 添加新属性
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name];
    });

  // 添加新的监听事件
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}
