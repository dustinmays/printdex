"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

/**
 * Renders a single snapshot of a 3D model to a static <img>.
 * No persistent WebGL context — the renderer is created, used once, and disposed.
 */
export default function ModelThumbnail({
  url,
  extension,
  className,
}: {
  url: string;
  extension: string;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Only start loading when scrolled into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const render = useCallback(async () => {
    if (!visible) return;

    try {
      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
      camera.position.set(180, 120, 180);
      camera.lookAt(0, 20, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(100, 100, 50);
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
      fillLight.position.set(-50, 50, -50);
      scene.add(fillLight);

      // Load model
      const group = new THREE.Group();

      if (extension === ".stl") {
        const loader = new STLLoader();
        const geometry = await new Promise<THREE.BufferGeometry>(
          (resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
          }
        );
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: 0x7caaff,
            metalness: 0.15,
            roughness: 0.6,
          })
        );
        group.add(mesh);
      } else if (extension === ".3mf") {
        const loader = new ThreeMFLoader();
        const object = await new Promise<THREE.Group>(
          (resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
          }
        );
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (
              !child.material ||
              (child.material as THREE.MeshStandardMaterial).color?.getHexString() === "ffffff"
            ) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x7caaff,
                metalness: 0.15,
                roughness: 0.6,
              });
            }
          }
        });
        group.add(object);
      }

      // Orient: Z-up → Y-up
      const box = new THREE.Box3().setFromObject(group);
      const size = new THREE.Vector3();
      box.getSize(size);

      if (size.z > size.y * 1.1) {
        group.rotation.x = -Math.PI / 2;
      }

      // Scale to fit
      box.setFromObject(group);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        group.scale.multiplyScalar(100 / maxDim);
      }

      // Position: centered X/Z, sitting on Y=0
      box.setFromObject(group);
      const center = new THREE.Vector3();
      box.getCenter(center);
      group.position.set(-center.x, -box.min.y, -center.z);

      scene.add(group);

      // Render once to canvas, extract image, dispose everything
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setSize(256, 256);
      renderer.setPixelRatio(1);
      renderer.render(scene, camera);

      const imageUrl = renderer.domElement.toDataURL("image/png");
      setDataUrl(imageUrl);

      // Clean up all GPU resources
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    } catch {
      setError(true);
    }
  }, [visible, url, extension]);

  useEffect(() => {
    render();
  }, [render]);

  if (error) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-background text-muted-foreground text-xs ${className}`}
      >
        Preview unavailable
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-background text-muted-foreground text-xs ${className}`}
      >
        {visible ? "Rendering..." : ""}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`bg-background flex items-center justify-center ${className}`}>
      <img
        src={dataUrl}
        alt="3D preview"
        className="w-full h-full object-contain"
        draggable={false}
      />
    </div>
  );
}
