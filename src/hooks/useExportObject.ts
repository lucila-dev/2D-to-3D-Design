import { useMemo } from 'react';
import * as THREE from 'three';
import { useDesignStore } from '../store/designStore';
import { ASSET_TYPES } from '../constants/assetTypes';
import { buildStrokeGeometries, centerGeometry, mergeGeometriesForExport } from '../utils/pathToGeometry';

export function useExportObject() {
  const {
    strokes,
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
    textureDataUrl,
  } = useDesignStore();

  return useMemo(() => {
    const config = ASSET_TYPES.find((a) => a.id === assetType)!;
    const parts = buildStrokeGeometries(
      strokes,
      config,
      conversionMode,
      { depth: extrudeDepth, depthMode, bevelAmount, limbThickness, sizeScale, hollow },
      latheSegments,
    );

    const transformed = parts.map((part) => {
      const stroke = strokes.find((s) => s.id === part.strokeId);
      const geom = part.geometry.clone();
      if (stroke?.transform) {
        const [px, py, pz] = stroke.transform.position;
        const [rx, ry, rz] = stroke.transform.rotation;
        geom.rotateX(rx);
        geom.rotateY(ry);
        geom.rotateZ(rz);
        geom.translate(px, py, pz);
      }
      return geom;
    });

    const geom =
      transformed.length === 0
        ? new THREE.BufferGeometry()
        : transformed.length === 1
          ? transformed[0]
          : mergeGeometriesForExport(transformed);

    centerGeometry(geom);

    const mat = new THREE.MeshStandardMaterial({
      color: material.color,
      metalness: material.metalness,
      roughness: material.roughness,
      side: THREE.DoubleSide,
    });
    if (textureDataUrl) {
      const tex = new THREE.TextureLoader().load(textureDataUrl);
      mat.map = tex;
    }
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `${assetType}-design`;
    return mesh;
  }, [
    strokes,
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
    textureDataUrl,
  ]);
}
