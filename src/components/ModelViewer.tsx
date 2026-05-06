"use client";

import { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useThree, useLoader, invalidate } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import * as THREE from "three";

/**
 * Orients a group so the model sits flat on the grid (Y=0) with its
 * largest flat face down, then scales it to fit within a normalized size.
 */
function orientAndScale(group: THREE.Group, camera: THREE.Camera) {
  group.rotation.set(0, 0, 0);
  group.scale.set(1, 1, 1);
  group.position.set(0, 0, 0);

  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);

  if (size.z > size.y * 1.1) {
    group.rotation.x = -Math.PI / 2;
  }

  box.setFromObject(group);
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return;

  group.scale.multiplyScalar(100 / maxDim);

  box.setFromObject(group);
  box.getCenter(center);
  group.position.set(-center.x, -box.min.y, -center.z);

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.position.set(180, 120, 180);
    camera.lookAt(0, 20, 0);
  }
}

function STLModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (groupRef.current) {
      orientAndScale(groupRef.current, camera);
      invalidate();
    }
  }, [geometry, camera]);

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#7caaff" metalness={0.15} roughness={0.6} />
      </mesh>
    </group>
  );
}

function ThreeMFModel({ url }: { url: string }) {
  const object = useLoader(ThreeMFLoader, url);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useEffect(() => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (
          !child.material ||
          (child.material as THREE.MeshStandardMaterial).color?.getHexString() === "ffffff"
        ) {
          child.material = new THREE.MeshStandardMaterial({
            color: "#7caaff",
            metalness: 0.15,
            roughness: 0.6,
          });
        }
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    if (groupRef.current) {
      orientAndScale(groupRef.current, camera);
      invalidate();
    }
  }, [object, camera]);

  return (
    <group ref={groupRef}>
      <primitive object={object} />
    </group>
  );
}

function ModelContent({ url, extension }: { url: string; extension: string }) {
  if (extension === ".stl") return <STLModel url={url} />;
  if (extension === ".3mf") return <ThreeMFModel url={url} />;
  return null;
}

function LoadingSpinner() {
  return (
    <mesh>
      <boxGeometry args={[10, 10, 10]} />
      <meshStandardMaterial color="#444" wireframe />
    </mesh>
  );
}

export default function ModelViewer({
  url,
  extension,
  className,
}: {
  url: string;
  extension: string;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-gray-400 text-sm ${className}`}>
        Failed to load preview
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 ${className}`}>
      <Canvas
        frameloop="demand"
        shadows
        onError={() => setError("Failed to render")}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <PerspectiveCamera makeDefault position={[180, 120, 180]} fov={45} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 50]} intensity={1} castShadow />
        <directionalLight position={[-50, 50, -50]} intensity={0.4} />
        <pointLight position={[0, 100, 0]} intensity={0.3} />
        <Suspense fallback={<LoadingSpinner />}>
          <ModelContent url={url} extension={extension} />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          minDistance={30}
          maxDistance={500}
          onChange={() => invalidate()}
        />
        <gridHelper args={[200, 20, "#333", "#222"]} />
      </Canvas>
    </div>
  );
}
