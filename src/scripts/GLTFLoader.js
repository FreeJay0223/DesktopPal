/**
 * GLTFLoader 包装器 - 使用Three.js内置的GLTF加载能力
 */

(function() {
  'use strict';
  
  // 等待THREE加载
  function waitForThree(callback) {
    if (typeof THREE !== 'undefined') {
      callback();
    } else {
      setTimeout(() => waitForThree(callback), 50);
    }
  }
  
  waitForThree(() => {
    console.log('Creating GLTFLoader...');
    
    // 创建一个更完整的GLTF解析器
    class GLTFLoader {
      constructor(manager) {
        this.manager = manager || THREE.DefaultLoadingManager;
      }
      
      load(url, onLoad, onProgress, onError) {
        const scope = this;
        
        const loader = new THREE.FileLoader(this.manager);
        loader.setResponseType('arraybuffer');
        
        loader.load(url, (buffer) => {
          try {
            scope.parse(buffer, (gltf) => {
              if (onLoad) onLoad(gltf);
            }, (error) => {
              if (onError) onError(error);
            });
          } catch (e) {
            if (onError) onError(e);
          }
        }, onProgress, onError);
      }
      
      parse(buffer, onLoad, onError) {
        const view = new DataView(buffer);
        const magic = view.getUint32(0, true);
        
        let json = null;
        let binBuffer = null;
        
        if (magic === 0x46546C67) {
          // GLB format
          const result = this.parseGLB(buffer);
          json = result.json;
          binBuffer = result.bin;
        } else {
          // Try as JSON
          try {
            const decoder = new TextDecoder();
            json = JSON.parse(decoder.decode(buffer));
          } catch (e) {
            onError(e);
            return;
          }
        }
        
        if (!json) {
          onError(new Error('Failed to parse GLTF'));
          return;
        }
        
        // Parse the GLTF
        this.parseGLTF(json, binBuffer, onLoad, onError);
      }
      
      parseGLB(buffer) {
        const view = new DataView(buffer);
        const magic = view.getUint32(0, true);
        
        if (magic !== 0x46546C67) {
          throw new Error('Invalid GLB magic');
        }
        
        const version = view.getUint32(4, true);
        const totalLength = view.getUint32(8, true);
        
        let json = null;
        let bin = null;
        
        let offset = 12;
        
        while (offset < totalLength) {
          const chunkLength = view.getUint32(offset, true);
          const chunkType = view.getUint32(offset + 4, true);
          
          if (chunkType === 0x4E4F534A) { // JSON
            const jsonBytes = new Uint8Array(buffer, offset + 8, chunkLength);
            const decoder = new TextDecoder();
            json = JSON.parse(decoder.decode(jsonBytes));
          } else if (chunkType === 0x004E4942) { // BIN
            bin = buffer.slice(offset + 8, offset + 8 + chunkLength);
          }
          
          offset += 8 + chunkLength;
        }
        
        return { json, bin };
      }
      
      parseGLTF(json, binBuffer, onLoad, onError) {
        try {
          const scene = new THREE.Group();
          const animations = [];
          
          // Create buffers array
          const buffers = [];
          if (json.buffers) {
            for (const bufferDef of json.buffers) {
              if (bufferDef.uri) {
                // External buffer - skip for now
                buffers.push(null);
              } else if (binBuffer) {
                buffers.push(new Uint8Array(binBuffer));
              }
            }
          }
          
          // Create buffer views
          const bufferViews = [];
          if (json.bufferViews) {
            for (const bvDef of json.bufferViews) {
              const buffer = buffers[bvDef.buffer];
              if (!buffer) continue;
              
              const byteOffset = bvDef.byteOffset || 0;
              const byteLength = bvDef.byteLength;
              
              // 创建正确的bufferView
              const view = new Uint8Array(byteLength);
              view.set(new Uint8Array(buffer.buffer, byteOffset, byteLength));
              bufferViews.push(view);
            }
          }
          
          console.log('Created', bufferViews.length, 'bufferViews');
          
          // Create accessors
          const accessors = [];
          if (json.accessors) {
            for (const accDef of json.accessors) {
              const bv = bufferViews[accDef.bufferView];
              if (!bv) continue;
              
              const byteOffset = accDef.byteOffset || 0;
              const componentType = accDef.componentType;
              const count = accDef.count;
              const type = accDef.type;
              
              const numComponents = this.getNumComponents(type);
              const totalBytes = count * numComponents * this.getBytesPerComponent(componentType);
              
              let data;
              if (componentType === 5126) { // FLOAT
                data = new Float32Array(bv.buffer, bv.byteOffset + byteOffset, count * numComponents);
              } else if (componentType === 5123) { // UNSIGNED_SHORT
                data = new Uint16Array(bv.buffer, bv.byteOffset + byteOffset, count * numComponents);
              } else if (componentType === 5121) { // UNSIGNED_BYTE
                data = new Uint8Array(bv.buffer, bv.byteOffset + byteOffset, count * numComponents);
              } else if (componentType === 5122) { // SHORT
                data = new Int16Array(bv.buffer, bv.byteOffset + byteOffset, count * numComponents);
              }
              
              accessors.push({
                data: data,
                count: count,
                type: type,
                min: accDef.min,
                max: accDef.max
              });
            }
          }
          
          // Create meshes
          const meshes = [];
          
          // First, load textures
          const textures = [];
          console.log('Loading textures, count:', json.textures ? json.textures.length : 0);
          
          if (json.textures) {
            for (let i = 0; i < json.textures.length; i++) {
              const texDef = json.textures[i];
              const imageDef = json.images && json.images[texDef.source];
              if (!imageDef) {
                console.log('No image for texture', i);
                continue;
              }
              
              console.log('Loading texture', i, 'image:', imageDef.uri || 'embedded', 'bufferView:', imageDef.bufferView);
              
              // Create texture
              const texture = new THREE.Texture();
              texture.flipY = false; // GLTF uses flipY=false
              
              // Load image
              if (imageDef.bufferView !== undefined) {
                // Embedded image - use Blob URL
                const bv = bufferViews[imageDef.bufferView];
                if (bv) {
                  console.log('Loading embedded image, size:', bv.length, 'mimeType:', imageDef.mimeType);
                  const mimeType = imageDef.mimeType || 'image/png';
                  const blob = new Blob([bv], { type: mimeType });
                  const url = URL.createObjectURL(blob);
                  
                  const img = new Image();
                  img.onload = () => {
                    console.log('Embedded image loaded:', img.width, 'x', img.height);
                    texture.image = img;
                    texture.needsUpdate = true;
                    URL.revokeObjectURL(url);
                  };
                  img.onerror = (err) => {
                    console.error('Failed to load embedded image:', err);
                  };
                  img.src = url;
                } else {
                  console.log('No bufferView for embedded image');
                }
              } else if (imageDef.uri) {
                // External image
                const fullUrl = imageDef.uri.startsWith('data:') ? imageDef.uri : 'file:///' + imageDef.uri.replace(/\\/g, '/');
                console.log('Loading external image:', fullUrl);
                
                const loader = new THREE.ImageLoader();
                loader.load(fullUrl, (image) => {
                  console.log('External image loaded:', image.width, 'x', image.height);
                  texture.image = image;
                  texture.needsUpdate = true;
                }, undefined, (err) => {
                  console.error('Failed to load image:', err);
                });
              }
              
              textures.push(texture);
            }
          }
          
          console.log('Created', textures.length, 'textures');
          
          // Create materials
          const materials = [];
          console.log('Creating materials, count:', json.materials ? json.materials.length : 0);
          
          if (json.materials) {
            for (let i = 0; i < json.materials.length; i++) {
              const matDef = json.materials[i];
              const mat = new THREE.MeshStandardMaterial({
                name: matDef.name || '',
                roughness: matDef.pbrMetallicRoughness?.roughnessFactor ?? 0.7,
                metalness: matDef.pbrMetallicRoughness?.metallicFactor ?? 0.0
              });
              
              // Base color
              if (matDef.pbrMetallicRoughness?.baseColorFactor) {
                mat.color.fromArray(matDef.pbrMetallicRoughness.baseColorFactor);
              }
              
              // Base color texture
              if (matDef.pbrMetallicRoughness?.baseColorTexture) {
                const texIndex = matDef.pbrMetallicRoughness.baseColorTexture.index;
                console.log('Material', i, 'baseColorTexture index:', texIndex);
                if (textures[texIndex]) {
                  mat.map = textures[texIndex];
                  console.log('Applied baseColorTexture to material', i);
                } else {
                  console.log('Texture not found for index', texIndex);
                }
              }
              
              // Normal texture
              if (matDef.normalTexture) {
                const texIndex = matDef.normalTexture.index;
                if (textures[texIndex]) {
                  mat.normalMap = textures[texIndex];
                }
              }
              
              // Metallic roughness texture
              if (matDef.pbrMetallicRoughness?.metallicRoughnessTexture) {
                const texIndex = matDef.pbrMetallicRoughness.metallicRoughnessTexture.index;
                if (textures[texIndex]) {
                  mat.roughnessMap = textures[texIndex];
                  mat.metalnessMap = textures[texIndex];
                }
              }
              
              // Emissive
              if (matDef.emissiveFactor) {
                mat.emissive.fromArray(matDef.emissiveFactor);
              }
              
              console.log('Created material', i, 'has map:', !!mat.map);
              materials.push(mat);
            }
          }
          
          if (json.meshes) {
            for (const meshDef of json.meshes) {
              const meshGroup = new THREE.Group();
              meshGroup.name = meshDef.name || '';
              
              for (const primitive of meshDef.primitives || []) {
                const geometry = new THREE.BufferGeometry();
                
                console.log('Processing primitive, material index:', primitive.material);
                
                // Position
                if (primitive.attributes.POSITION !== undefined) {
                  const acc = accessors[primitive.attributes.POSITION];
                  if (acc && acc.data) {
                    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(acc.data), 3));
                  }
                }
                
                // Normal
                if (primitive.attributes.NORMAL !== undefined) {
                  const acc = accessors[primitive.attributes.NORMAL];
                  if (acc && acc.data) {
                    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(acc.data), 3));
                  }
                }
                
                // UV
                if (primitive.attributes.TEXCOORD_0 !== undefined) {
                  const acc = accessors[primitive.attributes.TEXCOORD_0];
                  if (acc && acc.data) {
                    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(acc.data), 2));
                    console.log('UV coordinates found');
                  }
                }
                
                // Indices
                if (primitive.indices !== undefined) {
                  const acc = accessors[primitive.indices];
                  if (acc && acc.data) {
                    geometry.setIndex(new THREE.BufferAttribute(acc.data, 1));
                  }
                }
                
                geometry.computeVertexNormals();
                
                // Material
                let material;
                if (primitive.material !== undefined && materials[primitive.material]) {
                  material = materials[primitive.material];
                  console.log('Using material', primitive.material, 'has map:', !!material.map);
                } else {
                  material = new THREE.MeshStandardMaterial({
                    color: 0x888888,
                    roughness: 0.7,
                    metalness: 0.0
                  });
                  console.log('Using default material');
                }
                
                const mesh = new THREE.Mesh(geometry, material);
                meshGroup.add(mesh);
              }
              
              meshes.push(meshGroup);
            }
          }
          
          // Create nodes
          const nodes = [];
          if (json.nodes) {
            for (let i = 0; i < json.nodes.length; i++) {
              const nodeDef = json.nodes[i];
              let node;
              
              if (nodeDef.mesh !== undefined && meshes[nodeDef.mesh]) {
                node = meshes[nodeDef.mesh].clone();
              } else {
                node = new THREE.Object3D();
              }
              
              node.name = nodeDef.name || `node_${i}`;
              
              if (nodeDef.translation) {
                node.position.fromArray(nodeDef.translation);
              }
              if (nodeDef.rotation) {
                node.quaternion.fromArray(nodeDef.rotation);
              }
              if (nodeDef.scale) {
                node.scale.fromArray(nodeDef.scale);
              }
              if (nodeDef.matrix) {
                node.matrix.fromArray(nodeDef.matrix);
                node.matrix.decompose(node.position, node.quaternion, node.scale);
              }
              
              nodes.push(node);
            }
            
            // Build hierarchy
            for (let i = 0; i < json.nodes.length; i++) {
              const nodeDef = json.nodes[i];
              if (nodeDef.children) {
                for (const childIndex of nodeDef.children) {
                  nodes[i].add(nodes[childIndex]);
                }
              }
            }
          }
          
          // Add root nodes to scene
          if (json.scenes && json.scenes[0] && json.scenes[0].nodes) {
            for (const nodeIndex of json.scenes[0].nodes) {
              scene.add(nodes[nodeIndex]);
            }
          } else if (nodes.length > 0) {
            scene.add(nodes[0]);
          } else if (meshes.length > 0) {
            scene.add(meshes[0]);
          }
          
          // Parse animations
          if (json.animations) {
            for (const animDef of json.animations) {
              const tracks = [];
              
              for (const channel of animDef.channels || []) {
                const sampler = animDef.samplers && animDef.samplers[channel.sampler];
                if (!sampler) continue;
                
                const inputAcc = accessors[sampler.input];
                const outputAcc = accessors[sampler.output];
                if (!inputAcc || !outputAcc) continue;
                
                const times = new Float32Array(inputAcc.data);
                const values = new Float32Array(outputAcc.data);
                
                const targetNode = channel.target && channel.target.node;
                const path = channel.target && channel.target.path;
                
                if (targetNode !== undefined && nodes[targetNode]) {
                  const nodeName = nodes[targetNode].name || `node_${targetNode}`;
                  let track;
                  
                  if (path === 'translation') {
                    track = new THREE.VectorKeyframeTrack(
                      `${nodeName}.position`,
                      times,
                      values
                    );
                  } else if (path === 'rotation') {
                    track = new THREE.QuaternionKeyframeTrack(
                      `${nodeName}.quaternion`,
                      times,
                      values
                    );
                  } else if (path === 'scale') {
                    track = new THREE.VectorKeyframeTrack(
                      `${nodeName}.scale`,
                      times,
                      values
                    );
                  }
                  
                  if (track) tracks.push(track);
                }
              }
              
              if (tracks.length > 0) {
                const clip = new THREE.AnimationClip(
                  animDef.name || 'animation',
                  -1,
                  tracks
                );
                animations.push(clip);
              }
            }
          }
          
          console.log('GLTF parsed: scene children=' + scene.children.length + ', animations=' + animations.length);
          
          onLoad({
            scene: scene,
            animations: animations,
            asset: json.asset || {},
            parser: this
          });
          
        } catch (e) {
          console.error('GLTF parse error:', e);
          onError(e);
        }
      }
      
      getNumComponents(type) {
        switch (type) {
          case 'SCALAR': return 1;
          case 'VEC2': return 2;
          case 'VEC3': return 3;
          case 'VEC4': return 4;
          case 'MAT2': return 4;
          case 'MAT3': return 9;
          case 'MAT4': return 16;
          default: return 1;
        }
      }
      
      getBytesPerComponent(componentType) {
        switch (componentType) {
          case 5120: return 1; // BYTE
          case 5121: return 1; // UNSIGNED_BYTE
          case 5122: return 2; // SHORT
          case 5123: return 2; // UNSIGNED_SHORT
          case 5125: return 4; // UNSIGNED_INT
          case 5126: return 4; // FLOAT
          default: return 1;
        }
      }
    }
    
    // Register to THREE
    THREE.GLTFLoader = GLTFLoader;
    console.log('GLTFLoader registered to THREE');
  });
  
})();