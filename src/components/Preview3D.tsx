import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  Environment,
  ContactShadows,
  useGLTF,
  Center,
  Bounds,
  useBounds,
  TransformControls,
} from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import { XR, createXRStore } from '@react-three/xr';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { useDesignStore } from '../store/designStore';
import { ASSET_TYPES } from '../constants/assetTypes';
import { buildStrokeGeometries } from '../utils/pathToGeometry';
import { AvatarFigure } from './AvatarFigure';
import type { Stroke } from '../types';

export const xrStore = createXRStore();

const DEFAULT_TRANSFORM = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
};

function getStrokeTransform(stroke: Stroke | undefined) {
  return stroke?.transform ?? DEFAULT_TRANSFORM;
}

class ModelErrorBoundary extends Component<
  { children: ReactNode; resetKey: string; onError?: (message: string) => void },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'Failed to load 3D model' };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error.message || 'Failed to load 3D model');
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

/** Re-fit camera whenever the loaded content changes. */
function FitBounds({ watchKey }: { watchKey: string }) {
  const bounds = useBounds();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bounds.refresh().clip().fit();
    });
    return () => cancelAnimationFrame(id);
  }, [watchKey, bounds]);
  return null;
}

function normalizeRoot(root: THREE.Object3D, tintHex: string) {
  const tint = new THREE.Color(tintHex);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  root.scale.setScalar(1.6 / maxDim);

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const applyTint = (mat: THREE.Material) => {
        const m = mat.clone();
        if ('color' in m && (m as THREE.MeshStandardMaterial).color) {
          (m as THREE.MeshStandardMaterial).color.multiply(tint);
        }
        return m;
      };
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(applyTint);
      } else if (mesh.material) {
        mesh.material = applyTint(mesh.material);
      }
    }
  });
  return root;
}

function RotatingGroup({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const { autoRotate, physicsEnabled } = useDesignStore();

  useEffect(() => {
    if (physicsEnabled) return;
    let frame = 0;
    const tick = () => {
      if (autoRotate && groupRef.current) {
        groupRef.current.rotation.y += 0.008;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoRotate, physicsEnabled]);

  const content = <group ref={groupRef}>{children}</group>;

  if (physicsEnabled) {
    return (
      <RigidBody colliders="hull" restitution={0.3} friction={0.8}>
        {content}
      </RigidBody>
    );
  }

  return content;
}

function GlbModel({ url }: { url: string }) {
  const { characterTint } = useDesignStore();
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => normalizeRoot(scene.clone(true), characterTint), [scene, characterTint]);

  return (
    <RotatingGroup>
      <Center top>
        <primitive object={cloned} />
      </Center>
    </RotatingGroup>
  );
}

/** VRoid Hub / .vrm files via @pixiv/three-vrm */
function VrmModel({ url }: { url: string }) {
  const { characterTint } = useDesignStore();
  const setAiError = useDesignStore((s) => s.setAiError);
  const [scene, setScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let cancelled = false;
    let disposeScene: THREE.Object3D | null = null;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        if (cancelled) return;
        const vrm = gltf.userData.vrm;
        if (vrm) {
          VRMUtils.rotateVRM0(vrm);
          vrm.scene.traverse((obj: THREE.Object3D) => {
            obj.frustumCulled = false;
          });
          const root = vrm.scene.clone(true);
          disposeScene = vrm.scene;
          setScene(normalizeRoot(root, characterTint) as THREE.Group);
        } else {
          const root = gltf.scene.clone(true);
          disposeScene = gltf.scene;
          setScene(normalizeRoot(root, characterTint) as THREE.Group);
        }
      },
      undefined,
      (err) => {
        console.error(err);
        if (!cancelled) {
          setAiError(err instanceof Error ? err.message : 'Failed to load VRM');
        }
      },
    );

    return () => {
      cancelled = true;
      if (disposeScene) VRMUtils.deepDispose(disposeScene);
    };
  }, [url, characterTint, setAiError]);

  if (!scene) return null;

  return (
    <RotatingGroup>
      <Center top>
        <primitive object={scene} />
      </Center>
    </RotatingGroup>
  );
}

/** OBJ from Hunyuan: apply texture map directly (MTL paths are often relative and break). */
function ObjModelTextured({ url, textureUrl }: { url: string; textureUrl: string }) {
  const { characterTint } = useDesignStore();
  const obj = useLoader(OBJLoader, url);
  const texture = useLoader(THREE.TextureLoader, textureUrl);

  const cloned = useMemo(() => {
    const root = obj.clone(true);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = true;

    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          map: texture,
          color: '#ffffff',
          metalness: 0.1,
          roughness: 0.65,
          side: THREE.DoubleSide,
        });
      }
    });

    return normalizeRoot(root, characterTint);
  }, [obj, texture, characterTint]);

  return (
    <RotatingGroup>
      <Center top>
        <primitive object={cloned} />
      </Center>
    </RotatingGroup>
  );
}

function ObjModelPlain({ url }: { url: string }) {
  const { characterTint } = useDesignStore();
  const obj = useLoader(OBJLoader, url);

  const cloned = useMemo(() => {
    const root = obj.clone(true);
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: '#c4c4c4',
          metalness: 0.1,
          roughness: 0.65,
          side: THREE.DoubleSide,
        });
      }
    });
    return normalizeRoot(root, characterTint);
  }, [obj, characterTint]);

  return (
    <RotatingGroup>
      <Center top>
        <primitive object={cloned} />
      </Center>
    </RotatingGroup>
  );
}

function AiModel({
  url,
  mtlUrl,
  textureUrl,
  format,
}: {
  url: string;
  mtlUrl: string | null;
  textureUrl: string | null;
  format: 'glb' | 'obj' | null;
}) {
  const isVrm =
    /\.vrm(\?|$)/i.test(url) || url.includes('/api/vroid/vrm') || url.startsWith('blob:');
  const isObj =
    format === 'obj' ||
    (format !== 'glb' &&
      !isVrm &&
      (/\.obj(\?|$)/i.test(url) ||
        decodeURIComponent(url).toLowerCase().includes('.obj') ||
        Boolean(mtlUrl)));

  if (isVrm && (url.includes('/api/vroid/vrm') || /\.vrm(\?|$)/i.test(url))) {
    return <VrmModel url={url} />;
  }

  if (isObj) {
    if (textureUrl) {
      return <ObjModelTextured url={url} textureUrl={textureUrl} />;
    }
    return <ObjModelPlain url={url} />;
  }

  return <GlbModel url={url} />;
}

function applyDeltaToSelection(
  primaryId: string,
  selectedStrokeIds: string[],
  meshRefs: Map<string, THREE.Mesh>,
  dragStart: Map<string, { position: THREE.Vector3; rotation: THREE.Euler }>,
  primaryStart: { position: THREE.Vector3; rotation: THREE.Euler },
  primary: THREE.Object3D,
) {
  const deltaPos = primary.position.clone().sub(primaryStart.position);
  const deltaRot = new THREE.Euler(
    primary.rotation.x - primaryStart.rotation.x,
    primary.rotation.y - primaryStart.rotation.y,
    primary.rotation.z - primaryStart.rotation.z,
  );
  for (const id of selectedStrokeIds) {
    if (id === primaryId) continue;
    const mesh = meshRefs.get(id);
    const start = dragStart.get(id);
    if (!mesh || !start) continue;
    mesh.position.set(
      start.position.x + deltaPos.x,
      start.position.y + deltaPos.y,
      start.position.z + deltaPos.z,
    );
    mesh.rotation.set(
      start.rotation.x + deltaRot.x,
      start.rotation.y + deltaRot.y,
      start.rotation.z + deltaRot.z,
    );
  }
}

/** Big center grabber — free drag, no axis lines. */
function MoveHandle({
  primaryId,
  selectedStrokeIds,
  meshRefs,
  primaryRef,
  draggingRef,
  dragStartRef,
  primaryStartRef,
  onCommit,
}: {
  primaryId: string;
  selectedStrokeIds: string[];
  meshRefs: React.MutableRefObject<Map<string, THREE.Mesh>>;
  primaryRef: React.MutableRefObject<THREE.Mesh | null>;
  draggingRef: React.MutableRefObject<boolean>;
  dragStartRef: React.MutableRefObject<
    Map<string, { position: THREE.Vector3; rotation: THREE.Euler }>
  >;
  primaryStartRef: React.MutableRefObject<{ position: THREE.Vector3; rotation: THREE.Euler }>;
  onCommit: () => void;
}) {
  const { camera, gl, controls } = useThree();
  const handleRef = useRef<THREE.Mesh>(null);
  const planeRef = useRef(new THREE.Plane());
  const hitRef = useRef(new THREE.Vector3());
  const offsetRef = useRef(new THREE.Vector3());
  const pointerIdRef = useRef<number | null>(null);
  const centerLocalRef = useRef(new THREE.Vector3());

  const getGrabPoint = () => {
    const primary = primaryRef.current;
    if (!primary) return null;
    primary.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(primary);
    if (box.isEmpty()) return primary.getWorldPosition(new THREE.Vector3());
    return box.getCenter(new THREE.Vector3());
  };

  // Keep handle on the visual center of the selection
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const handle = handleRef.current;
      const primary = primaryRef.current;
      if (handle && primary) {
        const center = getGrabPoint();
        if (center) {
          handle.position.copy(center);
          const dist = camera.position.distanceTo(center);
          // Large, easy-to-grab handle (screen-relative)
          const s = Math.max(dist * 0.08, 0.35);
          handle.scale.setScalar(s);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [camera, primaryRef]);

  const beginDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const primary = primaryRef.current;
    if (!primary) return;

    draggingRef.current = true;
    pointerIdRef.current = e.pointerId;
    const orbit = controls as { enabled?: boolean } | null;
    if (orbit) orbit.enabled = false;

    primaryStartRef.current.position.copy(primary.position);
    primaryStartRef.current.rotation.copy(primary.rotation);
    dragStartRef.current.clear();
    for (const id of selectedStrokeIds) {
      const mesh = meshRefs.current.get(id);
      if (!mesh) continue;
      dragStartRef.current.set(id, {
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone(),
      });
    }

    const grab = getGrabPoint() ?? primary.position;
    centerLocalRef.current.copy(grab);
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
    planeRef.current.setFromNormalAndCoplanarPoint(normal, grab);
    if (e.ray.intersectPlane(planeRef.current, hitRef.current)) {
      offsetRef.current.copy(primary.position).sub(hitRef.current);
    } else {
      offsetRef.current.set(0, 0, 0);
    }

    try {
      gl.domElement.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    gl.domElement.style.cursor = 'grabbing';
  };

  const moveDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current || pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    const primary = primaryRef.current;
    if (!primary) return;

    const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
    planeRef.current.setFromNormalAndCoplanarPoint(normal, centerLocalRef.current);
    if (!e.ray.intersectPlane(planeRef.current, hitRef.current)) return;

    primary.position.copy(hitRef.current).add(offsetRef.current);
    if (handleRef.current) {
      const center = getGrabPoint();
      if (center) handleRef.current.position.copy(center);
    }

    applyDeltaToSelection(
      primaryId,
      selectedStrokeIds,
      meshRefs.current,
      dragStartRef.current,
      primaryStartRef.current,
      primary,
    );
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (pointerIdRef.current !== null && pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    if (draggingRef.current) {
      onCommit();
      draggingRef.current = false;
    }
    pointerIdRef.current = null;
    const orbit = controls as { enabled?: boolean } | null;
    if (orbit) orbit.enabled = true;
    gl.domElement.style.cursor = 'auto';
    try {
      gl.domElement.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <mesh
      ref={handleRef}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      renderOrder={1000}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 28, 20]} />
      <meshBasicMaterial
        color="#ff8fc4"
        transparent
        opacity={0.7}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function DesignMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const primaryRef = useRef<THREE.Mesh | null>(null);
  const [primaryMesh, setPrimaryMesh] = useState<THREE.Mesh | null>(null);
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const draggingRef = useRef(false);
  const dragStartRef = useRef<
    Map<string, { position: THREE.Vector3; rotation: THREE.Euler }>
  >(new Map());
  const primaryStartRef = useRef({
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
  });

  const {
    strokes,
    selectedStrokeId,
    selectedStrokeIds,
    transformMode,
    assetType,
    conversionMode,
    extrudeDepth,
    depthMode,
    bevelAmount,
    limbThickness,
    sizeScale,
    hollow,
    latheSegments,
    material,
    physicsEnabled,
    autoRotate,
  } = useDesignStore();

  const { controls } = useThree();
  const config = ASSET_TYPES.find((a) => a.id === assetType)!;
  const primaryId =
    (selectedStrokeId && selectedStrokeIds.includes(selectedStrokeId)
      ? selectedStrokeId
      : selectedStrokeIds[0]) ?? null;

  const parts = useMemo(
    () =>
      buildStrokeGeometries(
        strokes,
        config,
        conversionMode,
        { depth: extrudeDepth, depthMode, bevelAmount, limbThickness, sizeScale, hollow },
        latheSegments,
      ),
    [
      strokes,
      config,
      conversionMode,
      extrudeDepth,
      depthMode,
      bevelAmount,
      limbThickness,
      sizeScale,
      hollow,
      latheSegments,
    ],
  );

  const strokeById = useMemo(() => new Map(strokes.map((s) => [s.id, s])), [strokes]);

  useEffect(() => {
    if (!primaryId) {
      primaryRef.current = null;
      setPrimaryMesh(null);
      return;
    }
    const mesh = meshRefs.current.get(primaryId) ?? null;
    primaryRef.current = mesh;
    setPrimaryMesh((prev) => (prev === mesh ? prev : mesh));
  }, [primaryId, parts]);

  // Auto-select the only shape so the Move handle appears immediately
  useEffect(() => {
    if (parts.length === 1 && selectedStrokeIds.length === 0) {
      useDesignStore.getState().selectStroke(parts[0].strokeId);
    }
  }, [parts, selectedStrokeIds.length]);

  // Keep mesh transforms in sync with store when not dragging
  useEffect(() => {
    if (draggingRef.current) return;
    for (const [id, mesh] of meshRefs.current) {
      const tf = getStrokeTransform(strokeById.get(id));
      mesh.position.set(tf.position[0], tf.position[1], tf.position[2]);
      mesh.rotation.set(tf.rotation[0], tf.rotation[1], tf.rotation[2]);
    }
  }, [strokes, strokeById, parts]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || physicsEnabled || selectedStrokeIds.length > 0) return;
    let frame = 0;
    const tick = () => {
      if (autoRotate && groupRef.current && useDesignStore.getState().selectedStrokeIds.length === 0) {
        groupRef.current.rotation.y += 0.008;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoRotate, physicsEnabled, selectedStrokeIds.length]);

  const commitTransforms = () => {
    const primary = primaryRef.current;
    if (!primary || !primaryId) return;

    const updates = selectedStrokeIds
      .map((id) => {
        const mesh = meshRefs.current.get(id);
        if (!mesh) return null;
        return {
          id,
          transform: {
            position: [mesh.position.x, mesh.position.y, mesh.position.z] as [
              number,
              number,
              number,
            ],
            rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z] as [
              number,
              number,
              number,
            ],
          },
        };
      })
      .filter(Boolean) as { id: string; transform: NonNullable<Stroke['transform']> }[];

    useDesignStore.getState().updateTransforms(updates);
  };

  if (parts.length === 0) return null;

  const meshes = (
    <group ref={groupRef}>
      {parts.map((part) => {
        const stroke = strokeById.get(part.strokeId);
        const tf = getStrokeTransform(stroke);
        const selected = selectedStrokeIds.includes(part.strokeId);
        const isPrimary = part.strokeId === primaryId;
        return (
          <mesh
            key={part.strokeId}
            ref={(node) => {
              if (node) {
                meshRefs.current.set(part.strokeId, node);
                if (!draggingRef.current) {
                  node.position.set(tf.position[0], tf.position[1], tf.position[2]);
                  node.rotation.set(tf.rotation[0], tf.rotation[1], tf.rotation[2]);
                }
                if (isPrimary) {
                  primaryRef.current = node;
                  setPrimaryMesh((prev) => (prev === node ? prev : node));
                }
              } else {
                meshRefs.current.delete(part.strokeId);
                if (isPrimary) {
                  primaryRef.current = null;
                  setPrimaryMesh((prev) => (prev === null ? prev : null));
                }
              }
            }}
            geometry={part.geometry}
            castShadow
            receiveShadow
            onPointerDown={(e) => {
              e.stopPropagation();
              useDesignStore.getState().selectStroke(part.strokeId, e.nativeEvent.shiftKey);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onPointerOver={() => {
              document.body.style.cursor = transformMode === 'translate' ? 'grab' : 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'default';
            }}
          >
            <meshStandardMaterial
              color={part.color}
              metalness={material.metalness}
              roughness={material.roughness}
              emissive={selected ? '#e879a9' : material.emissive}
              emissiveIntensity={selected ? 0.45 : material.emissiveIntensity}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );

  if (physicsEnabled) {
    return (
      <RigidBody colliders="hull" restitution={0.3} friction={0.8}>
        {meshes}
      </RigidBody>
    );
  }

  return (
    <>
      {meshes}
      {primaryId && selectedStrokeIds.length > 0 && transformMode === 'translate' && (
        <MoveHandle
          primaryId={primaryId}
          selectedStrokeIds={selectedStrokeIds}
          meshRefs={meshRefs}
          primaryRef={primaryRef}
          draggingRef={draggingRef}
          dragStartRef={dragStartRef}
          primaryStartRef={primaryStartRef}
          onCommit={commitTransforms}
        />
      )}
      {primaryMesh && selectedStrokeIds.length > 0 && transformMode === 'rotate' && (
        <TransformControls
          object={primaryMesh}
          mode="rotate"
          size={1.15}
          space="world"
          onMouseDown={() => {
            draggingRef.current = true;
            const orbit = controls as { enabled?: boolean } | null;
            if (orbit) orbit.enabled = false;
            const primary = primaryRef.current;
            if (primary) {
              primaryStartRef.current.position.copy(primary.position);
              primaryStartRef.current.rotation.copy(primary.rotation);
            }
            dragStartRef.current.clear();
            for (const id of selectedStrokeIds) {
              const mesh = meshRefs.current.get(id);
              if (!mesh) continue;
              dragStartRef.current.set(id, {
                position: mesh.position.clone(),
                rotation: mesh.rotation.clone(),
              });
            }
          }}
          onObjectChange={() => {
            const primary = primaryRef.current;
            if (!primary || !primaryId || selectedStrokeIds.length <= 1) return;
            applyDeltaToSelection(
              primaryId,
              selectedStrokeIds,
              meshRefs.current,
              dragStartRef.current,
              primaryStartRef.current,
              primary,
            );
          }}
          onMouseUp={() => {
            commitTransforms();
            draggingRef.current = false;
            const orbit = controls as { enabled?: boolean } | null;
            if (orbit) orbit.enabled = true;
          }}
        />
      )}
    </>
  );
}

function SceneLighting() {
  const { lighting } = useDesignStore();
  return (
    <>
      <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />
      <directionalLight
        intensity={lighting.directionalIntensity}
        color={lighting.directionalColor}
        position={lighting.directionalPosition}
        castShadow={lighting.enableShadows}
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight intensity={0.3} position={[-3, 4, -3]} color="#818cf8" />
    </>
  );
}

function PreviewScene() {
  const {
    showGrid,
    physicsEnabled,
    aiModelUrl,
    aiModelMtlUrl,
    aiModelTextureUrl,
    aiModelFormat,
    strokes,
    avatarEnabled,
    avatarConfig,
  } = useDesignStore();
  const setAiError = useDesignStore((s) => s.setAiError);
  const watchKey = avatarEnabled
    ? `avatar-${JSON.stringify(avatarConfig)}`
    : aiModelUrl
      ? `${aiModelUrl}|${aiModelMtlUrl ?? ''}|${aiModelTextureUrl ?? ''}|${aiModelFormat ?? ''}`
      : `local-${strokes.map((s) => s.id).join(',')}`;

  const mesh = avatarEnabled ? (
    <AvatarFigure />
  ) : aiModelUrl ? (
    <ModelErrorBoundary
      resetKey={watchKey}
      onError={(message) => setAiError(`3D model load failed: ${message}`)}
    >
      <Suspense fallback={null}>
        <AiModel
          url={aiModelUrl}
          mtlUrl={aiModelMtlUrl}
          textureUrl={aiModelTextureUrl}
          format={aiModelFormat}
        />
      </Suspense>
    </ModelErrorBoundary>
  ) : (
    <DesignMesh />
  );

  return (
    <>
      <SceneLighting />
      <Environment preset="studio" environmentIntensity={0.4} />
      {showGrid && (
        <Grid
          infiniteGrid
          fadeDistance={20}
          fadeStrength={1}
          cellSize={0.5}
          sectionSize={2}
          cellColor="#4a3540"
          sectionColor="#6b4558"
        />
      )}
      <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={12} blur={2.5} far={6} />

      <Bounds key={watchKey} fit margin={1.6}>
        <FitBounds watchKey={watchKey} />
        {physicsEnabled ? (
          <Physics gravity={[0, -9.81, 0]}>
            <RigidBody type="fixed" colliders="cuboid">
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[40, 40]} />
                <meshStandardMaterial color="#2a1c24" roughness={0.9} />
              </mesh>
            </RigidBody>
            {mesh}
          </Physics>
        ) : (
          mesh
        )}
      </Bounds>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={40}
      />
    </>
  );
}

export function Preview3D() {
  const aiGenerating = useDesignStore((s) => s.aiGenerating);
  const aiModelUrl = useDesignStore((s) => s.aiModelUrl);
  const avatarEnabled = useDesignStore((s) => s.avatarEnabled);
  const transformMode = useDesignStore((s) => s.transformMode);
  const setTransformMode = useDesignStore((s) => s.setTransformMode);
  const selectedStrokeIds = useDesignStore((s) => s.selectedStrokeIds);
  const groupSelected = useDesignStore((s) => s.groupSelected);
  const ungroupSelected = useDesignStore((s) => s.ungroupSelected);
  const mergeSelected = useDesignStore((s) => s.mergeSelected);
  const selectStroke = useDesignStore((s) => s.selectStroke);
  const strokes = useDesignStore((s) => s.strokes);

  const hasSelection = selectedStrokeIds.length > 0;
  const canGroup = selectedStrokeIds.length >= 2;
  const canUngroup = selectedStrokeIds.some((id) => strokes.find((s) => s.id === id)?.groupId);

  return (
    <div className="preview-3d-wrap">
      <div className="canvas-label">
        <span>3D Preview</span>
        <div className="canvas-zoom-controls">
          <button
            type="button"
            className={`zoom-btn ${transformMode === 'translate' ? 'active' : ''}`}
            onClick={() => setTransformMode('translate')}
            title="Move"
          >
            Move
          </button>
          <button
            type="button"
            className={`zoom-btn ${transformMode === 'rotate' ? 'active' : ''}`}
            onClick={() => setTransformMode('rotate')}
            title="Rotate"
          >
            Rotate
          </button>
          <button
            type="button"
            className="zoom-btn"
            disabled={!canGroup}
            onClick={() => groupSelected()}
            title="Group selected"
          >
            Group
          </button>
          <button
            type="button"
            className="zoom-btn"
            disabled={!canGroup}
            onClick={() => mergeSelected()}
            title="Merge selected into a group"
          >
            Merge
          </button>
          <button
            type="button"
            className="zoom-btn"
            disabled={!canUngroup}
            onClick={() => ungroupSelected()}
            title="Ungroup"
          >
            Ungroup
          </button>
          {hasSelection && (
            <button
              type="button"
              className="zoom-btn"
              onClick={() => selectStroke(null)}
              title="Deselect"
            >
              ✕
            </button>
          )}
        </div>
        <span className="canvas-hint">
          {aiGenerating
            ? 'Generating…'
            : avatarEnabled
              ? 'Avatar'
              : aiModelUrl
                ? 'Model'
                : hasSelection
                  ? transformMode === 'translate'
                    ? 'Drag the pink handle to move'
                    : 'Drag the rings to rotate'
                  : 'Click a shape to move / rotate'}
        </span>
      </div>
      <Canvas
        shadows
        camera={{ position: [2.8, 2.2, 2.8], fov: 40, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true }}
        className="preview-canvas"
        onPointerMissed={() => {
          // Keep single-shape selection so the move handle stays available
          const { strokes, selectedStrokeIds, selectStroke } = useDesignStore.getState();
          const count = strokes.filter(
            (s) => s.tool !== 'eraser' && s.color !== 'transparent' && s.points.length >= 1,
          ).length;
          if (count <= 1) return;
          if (selectedStrokeIds.length && !aiModelUrl && !avatarEnabled) selectStroke(null);
        }}
      >
        <XR store={xrStore}>
          <color attach="background" args={['#1a1216']} />
          <PreviewScene />
        </XR>
      </Canvas>
      {aiGenerating && (
        <div className="ai-overlay" aria-live="polite">
          Generating AI 3D…
        </div>
      )}
    </div>
  );
}

useGLTF.preload('/characters/soldier.glb');
useGLTF.preload('/characters/robot.glb');
useGLTF.preload('/characters/xbot.glb');
useGLTF.preload('/characters/horse.glb');
useGLTF.preload('/characters/flamingo.glb');
useGLTF.preload('/characters/parrot.glb');
useGLTF.preload('/characters/stork.glb');
