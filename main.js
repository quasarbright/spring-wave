import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const gridWidth = 100
const gridHeight = 100
const equilibriumDistance = 5
// spring constant
const k = 0.1
// friction constant
const kf = 0.1
// gravity constant
const g = 0.000
const slitSize = 15

class Ball {
  constructor(position) {
    this.position = position
    this.material = new THREE.MeshBasicMaterial({ color: 0x0000FF });
    this.geometry = new THREE.SphereGeometry(1);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(position)
    // this.position aliases this.mesh.position
    this.position = this.mesh.position
    scene.add(this.mesh)
    this.velocity = new THREE.Vector3(0,0,0)
    this.mass = 1
  }

  // Vector3[] -> void
  // physics-based update
  update(neighborPositions) {
    const netForce = new THREE.Vector3(0,0,0)
    // spring forces
    for (const neighborPosition of neighborPositions) {
      const dy = this.position.y - neighborPosition.y
      // hooke's law
      const springForce = new THREE.Vector3(0,-k*dy)
      netForce.add(springForce)
    }
    // friction force
    const frictionForce = this.velocity.clone().setLength(-this.velocity.lengthSq() * kf)
    netForce.add(frictionForce)
    // gravity, morel like a spring at y=0 bc it can push up
    const gravityForce = new THREE.Vector3(0,-this.mass * g * this.position.y, 0)
    netForce.add(gravityForce)
    // F = ma
    const acceleration = netForce.clone().divideScalar(this.mass)
    // euler integration
    this.velocity.add(acceleration)
    // only allow vertical movement
    this.velocity.projectOnVector(new THREE.Vector3(0,1,0))
    // this.velocity.clampLength(-1/5,1/5)
    // this should mutate the mesh position as well since they are aliases
    this.position.add(this.velocity)
    // if (this.position.y < 0) {
    //   this.position.y = 0
    //   this.velocity.y = 0
    // }
    this.material.color = yToColor(this.position.y)
  }

  remove() {
    scene.remove(this.mesh)
  }
}

function yToColor(y) {
  // return new THREE.Color(0xFF0000).lerp(new THREE.Color(0x0000FF), clamp(mapInterval(y, -1, 1, 0, 1), 0, 1))
  return new THREE.Color(0x000000).lerp(new THREE.Color(0xFFFFFF), Math.abs(y/2))
}

function mapInterval(x, oldMin, oldMax, newMin, newMax) {
  const oldProgress = (x - oldMin) / (oldMax - oldMin)
  return newMin + oldProgress * (newMax - newMin)
}

function clamp(x, min, max) {
  if (x < min) {
    return min
  } else if (x > max) {
    return max
  } else {
    return x
  }
}

// doesn't move. rendered like a wall
class StaticBall extends Ball {
  constructor(position) {
    super(position)
    this.material = new THREE.MeshBasicMaterial({color: 0x888888})
    this.mesh.material = this.material
    this.geometry = new THREE.BoxGeometry(2,20,10)
    this.mesh.geometry = this.geometry
  }

  update(neighbors) {}
}

class ControlledBall extends Ball {
  constructor(position) {
    super(position)
    this.material = new THREE.MeshBasicMaterial({color: 0x00FF00})
    this.mesh.material = this.material
  }

  update(neighbors) {
    this.position.y = 50 * Math.sin(Date.now() / 200)
  }
}

class ScreenBall extends Ball {
  constructor(position) {
    super(position)
    const d = equilibriumDistance
    this.geometry = new THREE.BoxGeometry(d, 100, d)
    this.mesh.geometry = this.geometry
  }
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const color = 0xFFFFFF;
const intensity = 3;
const light = new THREE.DirectionalLight(color, intensity);
light.position.set(-1, 2, 4);
scene.add(light);

const grid = Array(gridHeight).fill(null).map((_, r) => Array(gridWidth).fill(null).map((_, c) => {
  const position = new THREE.Vector3(c * equilibriumDistance, 0, r * equilibriumDistance)
  if (r === 0 || r === gridHeight - 1 || c === gridWidth - 1) {
    return new ScreenBall(position)
  } else {
    return new Ball(position)
  }
}))

const wallCol = Math.floor(gridWidth / 2)
for (let r = 0; r < gridHeight; r++) {
  grid[r][wallCol].remove()
  grid[r][wallCol] = new StaticBall(grid[r][wallCol].position)
}
for (let r = Math.floor(gridHeight / 2 - slitSize / 2); r < Math.floor(gridHeight / 2 + slitSize / 2); r++) {
  grid[r][wallCol].remove()
  grid[r][wallCol] = new Ball(grid[r][wallCol].position)
}

// const v = 20
grid[Math.floor(gridHeight / 2)][0].remove()
grid[Math.floor(gridHeight / 2)][0] = new ControlledBall(grid[Math.floor(gridHeight / 2)][0].position)
// grid[gridHeight-1][0].velocity.y = -v

const controls = new OrbitControls(camera, renderer.domElement);
const midPoint = new THREE.Vector3(gridWidth * equilibriumDistance / 2, 0, gridHeight * equilibriumDistance / 2)
camera.position.set(-gridWidth* 2,gridWidth * 2,midPoint.z)
camera.lookAt(midPoint)
controls.update()
controls.target = midPoint

function animate() {
    renderer.render(scene, camera);
    const neighborPositions = grid.map(row => row.map(ball => ball.position.clone()))
    for (let r = 0; r < gridHeight; r++) {
      for (let c = 0; c < gridHeight; c++) {
        const ball = grid[r][c]
        const neighbors = []
        for (const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          if (dr === 0 && dc === 0) {
            continue
          }
          const nr = r + dr
          const nc = c + dc
          if (nr < gridHeight && nr >= 0 && nc < gridWidth && nc >= 0) {
            const neighbor = grid[nr][nc]
            if (!(neighbor instanceof StaticBall)) {
              neighbors.push(neighborPositions[nr][nc])
            }
          }
        }
        ball.update(neighbors)
      }
    }
    controls.update()
}