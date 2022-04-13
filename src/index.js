import { react, ReactDOM, useState } from "./react";

function App() {
  const [num, updateNum] = useState(0);
  const [num1, updateNum1] = useState(10);
  return (
    <div>
      <h1
        onClick={() => {
          updateNum((x) => x + 1);
        }}
      >
        hello {num}
      </h1>
      <h1
        onClick={() => {
          updateNum1((x) => x + 10);
        }}
      >
        hello {num1}
      </h1>
    </div>
  );
}
const container = document.getElementById("root");
ReactDOM.render(<App />, container);
// 首先我们可以从函数调用栈入手，理清react各个模块的功能和它们调用的顺序，对源码有个整体的认识
// 入口-》render-》commit
// 深度优先遍历fiber树
// 设计理念 异步可中断 代数效应

// 源码架构 jsx Fiber双缓存架构 scheduler lane模型 reconciler renderer concurrent
// commit before mutation layout
// 首次渲染的时候根据jsx生成我们的fiber，在update的时候，用最新的jsx跟当前fiber对象做对比生成新的fiber对象
// 快速响应，cpu的瓶颈和IO的瓶颈
// Fiber：react15的更新是同步的，因为它不能将任务分割，所以需要一套数据结构让它既能对应真实的dom又能作为分割的单元，这就是fiber
