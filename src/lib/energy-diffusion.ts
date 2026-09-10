import * as THREE from "three";

// Two finite releases can overlap: the selected body, then the well. Both
// are sampled from the scene clock, including the history along each trail.
const trajectory = /* glsl */ `
  uniform float uTime;
  uniform vec4 uReleases[2];
  uniform vec2 uStrength;
  uniform float uShell;
  attribute vec4 aSeed;
  attribute float aSlot;
  float life(float age) {
    return smoothstep(0.0, 0.065, age) * (1.0-smoothstep(0.7, 3.3, age));
  }
  vec3 flight(float age, vec4 release, float strength) {
    float t = max(0.0, age);
    float theta = aSeed.x * 6.2831853 + (1.0-exp(-t*1.8))*0.7*(0.4+aSeed.w);
    float latitude = (aSeed.z-0.5)*1.6;
    vec3 direction = normalize(vec3(cos(theta), latitude, sin(theta)));
    vec3 tangent = vec3(-sin(theta), 0.3*sin(theta*2.0), cos(theta));
    float distance = uShell + (1.0-exp(-t*1.25)) * (1.5+aSeed.y*2.5) * strength;
    float curl = (0.12+aSeed.w*0.38)*t*t/(1.0+t);
    vec3 p = release.xyz + direction*distance + tangent*curl;
    p.y += sin(t*2.3+aSeed.x*9.0)*t*0.11;
    return p;
  }
`;

/** Fine flecks and continuous, tapered filaments; no video or postprocessing. */
export function createEnergyDiffusion() {
  const uniforms = {
    uTime: { value: 0 },
    uReleases: { value: [new THREE.Vector4(0, 0, 0, -100), new THREE.Vector4(0, 0, 0, -100)] },
    uStrength: { value: new THREE.Vector2(1, 1) },
    uPixelRatio: { value: 1 },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uOpacity: { value: 1 },
    uShell: { value: 0.12 },
  };
  const hash = (n: number) => {
    const v = Math.sin(n * 127.1 + 19.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const makeGeometry = (ribbons: boolean) => {
    const position: number[] = [], seed: number[] = [], slots: number[] = [];
    const along: number[] = [], side: number[] = [], indices: number[] = [];
    const count = ribbons ? 28 : 228;
    const steps = ribbons ? 20 : 1;
    for (let slot = 0; slot < 2; slot++) {
      for (let i = 0; i < count; i++) {
        const base = position.length / 3;
        for (let j = 0; j < steps; j++) {
          for (let k = 0; k < (ribbons ? 2 : 1); k++) {
            position.push(0, 0, 0);
            seed.push(hash(i+1), hash(i+61), hash(i+137), hash(i+227));
            slots.push(slot);
            along.push(ribbons ? j/(steps-1) : 0);
            side.push(k === 0 ? -1 : 1);
          }
          if (ribbons && j < steps-1) {
            const v = base+j*2;
            indices.push(v,v+1,v+2,v+1,v+3,v+2);
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(position,3));
    geometry.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed,4));
    geometry.setAttribute("aSlot", new THREE.Float32BufferAttribute(slots,1));
    geometry.setAttribute("aAlong", new THREE.Float32BufferAttribute(along,1));
    geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(side,1));
    if (ribbons) geometry.setIndex(indices);
    return geometry;
  };
  const points = makeGeometry(false);
  const ribbons = makeGeometry(true);
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false,
    blending: THREE.AdditiveBlending,
    vertexShader: trajectory + /* glsl */ `
      uniform float uPixelRatio;
      uniform float uOpacity;
      varying float vAlpha;
      varying float vShape;
      varying float vAngle;
      void main() {
        int slot = int(aSlot);
        float age = uTime-uReleases[slot].w-aSeed.y*0.15;
        vec3 p = flight(age,uReleases[slot],uStrength[slot]);
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        float flicker = 0.66+0.34*sin(age*(14.0+aSeed.w*18.0)+aSeed.x*40.0);
        vAlpha = life(age)*flicker*uOpacity;
        vShape = aSeed.w;
        vAngle = aSeed.x*6.28+age*(1.0+aSeed.z*3.0);
        gl_PointSize = clamp((1.8+aSeed.w*3.7)*8.0/max(1.0,-mv.z),1.2,7.0)*uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vShape;
      varying float vAngle;
      void main() {
        vec2 p = gl_PointCoord-0.5;
        p = mat2(cos(vAngle),-sin(vAngle),sin(vAngle),cos(vAngle))*p;
        float glow = exp(-dot(p,p)*22.0)*0.19;
        float shard = (1.0-smoothstep(0.07,0.22,abs(p.x)+abs(p.y)*(1.0+vShape*2.0)));
        float alpha = (glow+shard)*vAlpha;
        if(alpha<0.003) discard;
        gl_FragColor = vec4(vec3(0.88,0.95,1.0),alpha);
      }
    `,
  });
  const filamentMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, toneMapped: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: trajectory + /* glsl */ `
      attribute float aAlong;
      attribute float aSide;
      uniform vec2 uViewport;
      uniform float uOpacity;
      varying float vAlpha;
      varying float vSide;
      void main() {
        int slot = int(aSlot);
        float age = uTime-uReleases[slot].w-aSeed.y*0.15;
        float at = age-aAlong*(0.10+aSeed.w*0.25);
        vec3 p = flight(at,uReleases[slot],uStrength[slot]);
        vec3 next = flight(at+0.018,uReleases[slot],uStrength[slot]);
        vec4 clip = projectionMatrix*modelViewMatrix*vec4(p,1.0);
        vec4 nextClip = projectionMatrix*modelViewMatrix*vec4(next,1.0);
        vec2 tangent = (nextClip.xy/nextClip.w-clip.xy/clip.w)*uViewport;
        tangent = normalize(tangent+vec2(0.00001));
        vec2 normal = vec2(-tangent.y,tangent.x);
        float taper = pow(1.0-aAlong,0.8);
        clip.xy += normal*aSide*(0.65+aSeed.w*0.55)*taper/uViewport*clip.w*2.0;
        gl_Position = clip;
        vSide = aSide;
        vAlpha = life(age)*smoothstep(0.0,0.12,at)*taper*uOpacity*0.58;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vSide;
      void main() {
        float alpha = vAlpha*(1.0-smoothstep(0.25,1.0,abs(vSide)));
        if(alpha<0.002) discard;
        gl_FragColor = vec4(0.84,0.92,1.0,alpha);
      }
    `,
  });
  let slot = 0;
  return {
    points, ribbons, material, filamentMaterial, uniforms,
    release(origin: THREE.Vector3, time: number, strength = 1) {
      uniforms.uReleases.value[slot].set(origin.x,origin.y,origin.z,time);
      uniforms.uStrength.value.setComponent(slot,strength);
      slot = (slot+1)%2;
    },
    dispose() { points.dispose(); ribbons.dispose(); material.dispose(); filamentMaterial.dispose(); },
  };
}
