import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportGLTF(
  object: THREE.Object3D,
  filename = 'design.glb',
): Promise<void> {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) {
          downloadBlob(new Blob([result], { type: 'model/gltf-binary' }), filename);
        } else {
          const json = JSON.stringify(result, null, 2);
          downloadBlob(new Blob([json], { type: 'application/json' }), filename.replace('.glb', '.gltf'));
        }
        resolve();
      },
      (err) => reject(err),
      { binary: true },
    );
  });
}

export function exportOBJ(object: THREE.Object3D, filename = 'design.obj'): void {
  const exporter = new OBJExporter();
  const result = exporter.parse(object);
  downloadBlob(new Blob([result], { type: 'text/plain' }), filename);
}

/** Export Unity-friendly package hint as JSON sidecar */
export function exportUnityManifest(assetName: string): void {
  const manifest = {
    format: 'glb',
    engine: 'Unity',
    importSteps: [
      'Download the .glb file',
      'Drag into Assets folder in Unity',
      'Set Material to URP/HDRP Lit shader',
      'Adjust scale if needed (default units: meters)',
    ],
    recommendedSettings: {
      scaleFactor: 1,
      generateColliders: true,
      importMaterials: true,
    },
    assetName,
  };
  downloadBlob(
    new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }),
    `${assetName}-unity-import.json`,
  );
}

/** Export Blender import instructions */
export function exportBlenderManifest(assetName: string): void {
  const manifest = {
    format: 'glb',
    engine: 'Blender',
    importSteps: [
      'File → Import → glTF 2.0 (.glb/.gltf)',
      'Select the downloaded file',
      'Material nodes are preserved',
      'Use Subdivision Surface for smoother plushie/jewellery meshes',
    ],
    assetName,
  };
  downloadBlob(
    new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }),
    `${assetName}-blender-import.json`,
  );
}
