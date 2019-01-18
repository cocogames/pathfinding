import produce from "immer"
import React, { Component, Fragment } from "react"
import { createPathFinder, eucledianDistance } from "./algo/createPathFinder"
import PriorityQueue from "./algo/queues/PriorityQueue"
import "./App.css"
import { dist } from "./math"
import { newEntries, entries } from "./utils"
import MyCanvas from "./components/MyCanvas"
import FIFO from "./algo/queues/FIFO"

class App extends Component {
  state = {
    allNodes: newEntries(),
    nodes: newEntries(),
    links: newEntries(),
    obstacle1: { x1: 150, x2: 288, y1: 90, y2: 473 },
    obstacle2: { x1: 312, x2: 557, y1: 410, y2: 470 },
    pathSteps: null,
    step: 0,
    hasDonePath: false,
    queue: "fifo",
    heuristic: "omogeneus",
    autoStep: 2,
    stopOnPath: true
  }

  async componentDidMount() {
    await this.generateNodes(8, 70)
    // await this.generateLinks(100)

    this.setState(
      {
        robot: this.findClosestNode({ x: 400, y: 100 }),
        goal: this.findClosestNode({ x: 500, y: 500 })
      },
      () => this.test()
    )

    this.checkNodes()

    setTimeout(this.tick, 300)
  }

  tick = () => {
    const autoStep = parseInt(this.state.autoStep)
    if (
      autoStep > 0 &&
      this.state.step < this.state.pathSteps.length - 1 &&
      (!this.state.stopOnPath ||
        this.state.pathSteps[this.state.step].path === null)
    ) {
      console.log("autostep", autoStep)
      this.setState(
        produce(state => {
          state.step++
        })
      )
    }
    setTimeout(this.tick, [1000, 1500, 800, 400, 200][autoStep])
  }

  generateNodes(size, dist) {
    return new Promise((resolve, reject) => {
      let nodes = newEntries()

      const addNode = (i, node) => {
        nodes.byId[i] = { ...node, neighbors: [] }
        nodes.allIds.push(i)
      }

      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          addNode(i * size + j, {
            x: j * dist + dist / 2,
            y: i * dist + dist / 2
          })
        }
      }

      this.setState({ allNodes: nodes, nodes }, () => resolve())
    })
  }

  generateLinks(maxDist) {
    return new Promise((resolve, reject) => {
      // this.setState(
      // produce(this.state, state => {
      // console.log(JSON.stringify(state))
      const nodes = JSON.parse(JSON.stringify(this.state.nodes)) //grrr
      let links = newEntries()

      const addLink = (i, l) => {
        links.byId[i] = l
        links.allIds.push(i)
      }

      let index = 0
      for (let i = 0; i < nodes.allIds.length; i++) {
        for (let j = i + 1; j < nodes.allIds.length; j++) {
          const ida = nodes.allIds[i]
          const idb = nodes.allIds[j]
          const a = nodes.byId[ida]
          const b = nodes.byId[idb]

          if (a && b && dist(a, b) < maxDist) {
            a.neighbors.push(idb)
            b.neighbors.push(ida)
            addLink(index, { from: ida, to: idb })

            index++
          }
        }
      }

      this.setState({ nodes, links }, () => resolve())
    })
  }

  checkNodes() {
    this.setState({ pathSteps: null, step: 0, hasDonePath: false })

    return new Promise((resolve, reject) => {
      const newNodes = produce(this.state.allNodes, nodes => {
        const { obstacle1: o1, obstacle2: o2 } = this.state
        return entries(nodes).map(([id, node]) => {
          let valid = true //not inside an obstacle

          //safety buffer
          const sb = 0
          if (
            (node.x > o1.x1 - sb &&
              node.x < o1.x2 + sb &&
              node.y > o1.y1 - sb &&
              node.y < o1.y2 + sb) ||
            (node.x > o2.x1 - sb &&
              node.x < o2.x2 + sb &&
              node.y > o2.y1 - sb &&
              node.y < o2.y2 + sb)
          ) {
            valid = false
          }
          return [
            id,
            {
              ...node,
              valid
            }
          ]
        })
      })

      const nodes = newNodes
        .filter(([id, node]) => node.valid)
        .reduce(
          (acc, [id, node]) => ({
            byId: { ...acc.byId, [id]: node },
            allIds: [...acc.allIds, id]
          }),
          {
            byId: {},
            allIds: []
          }
        )

      this.setState({ nodes, links: newEntries() }, async () => {
        await this.generateLinks(100)
        this.test()
      })
    })

    //this.setState({ alllNodes: { ...this.state.nodes, byId: newNodes } })
  }

  test = () => {
    // const pf = createPathFinder(new FIFO()) //BFS
    // const pf = createPathFinder(new PriorityQueue(), () => 0) // djstra
    // const pf = createPathFinder(new PriorityQueue(), eucledianDistance) //a*

    const queue = this.state.queue === "fifo" ? new FIFO() : new PriorityQueue()
    const heuristic =
      this.state.heuristic === "omogeneus" ? () => 0 : eucledianDistance

    const pf = createPathFinder(queue, heuristic)

    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
    console.log("pf with", queue, heuristic)

    const findPath = pf(this.state.nodes, this.state.links)
    this.setState({ pathSteps: [], step: 0, hasDonePath: false }, () => {
      for (let pathStep of findPath(this.state.robot.id, this.state.goal.id)) {
        // console.log(pathStep)
        this.setState(
          produce(state => {
            state.pathSteps.push(pathStep)
            // if (pathStep.path != null && state.step === 0)
            //   state.step = state.pathSteps.length - 1
          }),
          () => {
            this.setState({ hasDonePath: true })
          }
        )
      }
    })
  }
  // p: {x,y}
  findClosestNode = p => {
    let minD = 9999
    let n = null

    entries(this.state.nodes).forEach(([id, node]) => {
      const d = dist(p, node)
      if (d < minD) {
        minD = d
        n = { ...node, id }
      }
    })
    return n
  }

  onRobotDrag = event => {
    const { x, y } = event.target.attrs
    const closest = this.findClosestNode({ x, y })
    this.setState({ robot: { ...closest } }, () => this.test())
  }

  onGoalDrag = event => {
    const { x, y } = event.target.attrs
    const closest = this.findClosestNode({ x, y })
    this.setState({ goal: { ...closest } }, () => this.test())
  }

  render() {
    const {
      pathSteps,
      step,
      hasDonePath,
      heuristic,
      queue,
      autoStep
    } = this.state

    const pathState = hasDonePath ? pathSteps[step] : {}

    if (hasDonePath) console.log(pathState)

    const algoName =
      queue === "fifo"
        ? "Breadth-first search"
        : heuristic === "omogeneus"
        ? "Dijkstra"
        : "A*"

    return (
      <div className="mainContainer">
        <div className="left">
          <div className="top">
            {/* <button onClick={this.test}> TEST </button> */}
            <span className={"side-thing"}>
              Step: {hasDonePath && `${step}/${pathSteps.length - 1}`}
            </span>
            <button
              onClick={() =>
                this.setState({
                  step: pathSteps.findIndex(step => step.path)
                })
              }
            >
              Steps needed for first solution{" "}
              {hasDonePath && pathSteps.findIndex(step => step.path)}
            </button>
            <br />
            {hasDonePath && (
              <input
                style={{ width: "800px" }}
                type="range"
                min={0}
                max={pathSteps.length - 1}
                value={step}
                step={1}
                onInput={e => this.setState({ step: e.target.value })}
                onChange={e => {
                  this.setState({ step: e.target.value })
                }}
              />
            )}
            <br />
            <span />
            <label className={"side-thing"}>
              AutoStep :
              <input
                style={{ width: "100px" }}
                type="range"
                min={0}
                max={4}
                value={autoStep}
                step={1}
                onInput={e => this.setState({ autoStep: e.target.value })}
                onChange={e => {
                  this.setState({ autoStep: e.target.value })
                }}
              />
              {["off", "slow", "fast", "faster", "fastest"][autoStep]}
            </label>
            <label>
              <input
                type="checkbox"
                checked={this.state.stopOnPath}
                onChange={event =>
                  this.setState({ stopOnPath: event.target.checked })
                }
              />
              Stop on first path
            </label>
          </div>
          <div className="canvasContainer">
            <MyCanvas
              {...this.state}
              onRobotDrag={this.onRobotDrag}
              onGoalDrag={this.onGoalDrag}
              onObstacleMove={name => positions =>
                this.setState({ [name]: positions })}
              onObstacleMoveEnd={() => this.checkNodes()}
            />
          </div>
        </div>
        <div className="optionsPanel">
          <h1>options</h1>
          <br />
          <br />
          <label>
            Queue:
            <br />
            <select
              value={queue}
              onChange={e => {
                this.setState({ queue: e.target.value }, () => this.test())
              }}
            >
              <option value="fifo">First In First Out</option>
              <option value="priority">Priority Queue</option>
            </select>
          </label>
          <br />
          <br />
          <label>
            Heuristic:
            <br />
            <select
              disabled={queue === "fifo"}
              value={heuristic}
              onChange={e => {
                console.log(e, e.target.value)
                this.setState({ heuristic: e.target.value }, () => this.test())
              }}
            >
              <option value="omogeneus">h(x) = k</option>
              <option value="euclidean">Eucledian Distance</option>
            </select>
          </label>
          <br />
          <p>
            This looks like : <strong>{algoName}</strong>
          </p>
          {hasDonePath && (
            <Fragment>
              <strong> nodes in frontier: </strong>
              <table>
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {pathState.frontier.items.map(({ id, cost }) => (
                    <tr key={id}>
                      <td>{id}</td>
                      <td>{Math.round(cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Fragment>
          )}
          {/* {hasDonePath && (
            <table>
              <tr>
                <th>Node</th>
                <th>Cost so far</th>
              </tr>
              {Object.entries(pathState.costsSoFar).map(([i, cost]) => (
                <tr>
                  <td>{i}</td>
                  <td>{Math.round(cost / 10)}</td>
                </tr>
              ))}
            </table>
          )} */}
        </div>
      </div>
    )
  }
}

export default App
