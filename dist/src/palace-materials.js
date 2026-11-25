import * as THREE from 'three';

// One opaque water/stone surface. Integrating the veins into the reflector
// removes the second, nearly coincident floor from the reflected scene.
export const palaceFloorShader = {
  name: 'PalaceWaterStone',
  uniforms: {
    color:{value:new THREE.Color('#173b3e')}, tDiffuse:{value:null}, textureMatrix:{value:new THREE.Matrix4()},
    uTime:{value:0}, uLevel:{value:0}, uPulse:{value:0}, uAmount:{value:0}, uFluid:{value:1},
    uRings:{value:new Float32Array(8).fill(-100)}, uTexel:{value:new THREE.Vector2(1/1024,1/1024)},
    uFogColor:{value:new THREE.Color('#03171e')}, uFogDensity:{value:.0185}
  },
  vertexShader:`
    uniform mat4 textureMatrix;
    varying vec4 vReflection; varying vec3 vWorld;
    void main(){vReflection=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
  `,
  fragmentShader:`
    uniform sampler2D tDiffuse; uniform vec3 color; uniform vec2 uTexel;
    uniform float uTime,uLevel,uPulse,uAmount,uFluid,uRings[8],uFogDensity;
    uniform vec3 uFogColor;
    varying vec4 vReflection; varying vec3 vWorld;
    vec2 hash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
    void main(){
      vec2 p=vWorld.xz*vec2(.31,.27);
      p+=.42*vec2(sin(p.y*1.83+.67*cos(p.x*1.27)),cos(p.x*2.02-.53*sin(p.y)));
      p+=.12*vec2(sin(p.y*4.6+p.x+uTime*.06),cos(p.x*3.7+p.y-uTime*.05));
      vec2 cell=floor(p),f=fract(p);float first=10.,second=10.;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
        vec2 n=vec2(float(x),float(y));float d=length(n+hash(cell+n)-f);
        if(d<first){second=first;first=d;}else if(d<second){second=d;}
      }
      float edge=second-first;
      float aa=max(fwidth(edge)*1.25,.0025);
      float width=.043+.024*sin(p.x*3.1+p.y*4.);
      float veins=1.-smoothstep(max(0.,width-aa),width+aa,edge);
      float inner=1.-smoothstep(0.,.020+aa,edge);
      float soft=exp(-edge*11.)/(1.+aa*4.);
      float r=length(vec2(vWorld.x,(vWorld.z+6.)*.62)),rip=0.;
      for(int k=0;k<8;k++){
        float age=uRings[k];
        if(age>=0.&&age<3.5){
          float gap=(r-age*mix(9.,3.2,uFluid))*mix(1.6,.48,uFluid);
          rip+=exp(-gap*gap)*pow(1.-age/3.5,1.3)*mix(1.,smoothstep(0.,.55,age)*.65,uFluid);
        }
      }
      vec2 uv=vReflection.xy/max(vReflection.w,.0001);
      float valid=step(.0001,vReflection.w)*smoothstep(0.,.025,uv.x)*smoothstep(0.,.025,uv.y)*(1.-smoothstep(.975,1.,uv.x))*(1.-smoothstep(.975,1.,uv.y));
      vec2 drift=vec2(sin(vWorld.z*.7+uTime*.18),cos(vWorld.x*.8+uTime*.13))*.00055;
      uv=clamp(uv+drift,uTexel*3.,vec2(1.)-uTexel*3.);
      vec2 blur=uTexel*1.7;
      vec3 reflection=texture2D(tDiffuse,uv).rgb*.4;
      reflection+=(texture2D(tDiffuse,uv+vec2(blur.x,0.)).rgb+texture2D(tDiffuse,uv-vec2(blur.x,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,blur.y)).rgb+texture2D(tDiffuse,uv-vec2(0.,blur.y)).rgb)*.15;
      float facing=clamp(normalize(cameraPosition-vWorld).y,0.,1.);
      float fresnel=.29+.33*pow(1.-facing,3.);
      float caustic=pow(.5+.5*sin(p.x*1.8+sin(p.y*2.2-uTime*.13)+uTime*.16),9.);
      vec3 stone=vec3(.013,.037,.041)+color*.055+caustic*vec3(.012,.035,.033);
      float aisle=1.-smoothstep(5.7,9.9,abs(vWorld.x));
      vec3 c=mix(stone,reflection,fresnel*valid*(.69+.31*aisle));
      float pattern=.15+.85*aisle;
      veins*=pattern; inner*=pattern; soft*=pattern;
      float pulse=clamp(uPulse,0.,1.35);
      float thread=.5+.5*sin(p.y*1.8+sin(p.x*2.7)-uTime*.13);
      vec3 pearl=vec3(.32,.30,.23);
      vec3 pool=mix(vec3(.09,.86,.78),vec3(.72,.86,.59),.52*thread);
      c+=veins*(pearl*.57+pulse*pool*(.52+.52*thread));
      c+=inner*(pearl*.31+pool*.54*pulse)+soft*pool*.18*pulse;
      c+=rip*(veins+.22*soft)*vec3(.19,.93,.84)*mix(uAmount,pulse,uFluid);
      float rootDistance=(abs(vWorld.x)-5.6)*.70;
      float roots=exp(-rootDistance*rootDistance);
      float bay=.52+.48*cos((vWorld.z-6.)*.757);
      c+=roots*bay*pulse*vec3(.012,.14,.11)+caustic*roots*uLevel*vec3(.10,.055,.016);
      float dist=length(cameraPosition-vWorld);float fog=1.-exp(-uFogDensity*uFogDensity*dist*dist);
      gl_FragColor=vec4(mix(c,uFogColor,fog),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
};

export function pearlMembrane(warm=false){
  return new THREE.ShaderMaterial({
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uColor:{value:new THREE.Color(warm?'#edc58f':'#b6d8df')},uEnergy:{value:0},uAlpha:{value:warm?.64:.34},uTime:{value:0},uPhase:{value:0},uWarm:{value:warm?1:0}},
    vertexShader:`
      varying vec3 vN,vV; varying vec2 vUv;
      uniform float uTime,uPhase,uWarm;
      #include <fog_pars_vertex>
      void main(){
        vUv=uv;vec3 p=position;
        float edge=smoothstep(.5,1.,uv.y)*(1.-uWarm);
        p.xz*=1.+sin(uTime*.75+uPhase)*edge*.018;
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);
        vN=normalize(normalMatrix*normal);vV=normalize(-mvPosition.xyz);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader:`
      uniform vec3 uColor;uniform float uEnergy,uAlpha,uWarm;
      varying vec3 vN,vV;varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){
        float facing=clamp(abs(dot(normalize(vN),normalize(vV))),0.,1.);
        float fres=pow(1.-facing,2.2);
        float angle=vUv.x*48.;
        float radial=.5+.5*cos(angle*6.283185);
        float visibility=1.-smoothstep(.23,1.1,fwidth(angle));
        float rib=smoothstep(.82,.99,radial)*visibility;
        float capHeight=clamp(vUv.y,0.,1.);
        float rim=pow(capHeight,7.);
        float crown=pow(1.-capHeight,2.7);
        float body=.22+.71*fres+.29*rib+.48*rim+.30*crown;
        float warmBody=.25+.39*fres+.19*rib+.23*rim+.48*crown;
        vec3 c=uColor*mix(body,warmBody,uWarm)*(1.+uEnergy*mix(1.65,1.85,uWarm));
        c+=vec3(.69,.77,.92)*(rib*.25+fres*fres*.18);
        c+=uWarm*crown*vec3(1.25,.45,.065)*(.25+uEnergy*1.05);
        gl_FragColor=vec4(c,clamp(uAlpha+fres*.20+rib*.09,0.,.92));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true
  });
}

export function strandMaterial(phase){
  return new THREE.ShaderMaterial({
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uTime:{value:0},uPhase:{value:phase},uOpacity:{value:.40}},
    vertexShader:`
      uniform float uTime,uPhase;varying float vTail;
      #include <fog_pars_vertex>
      void main(){vec3 p=position;vTail=clamp(-p.y/2.2,0.,1.);
        p.x+=sin(uTime*.65+p.y*2.1+uPhase)*vTail*.16;
        p.z+=cos(uTime*.51+p.y*1.7+uPhase)*vTail*.12;
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader:`
      uniform float uOpacity;varying float vTail;
      #include <fog_pars_fragment>
      void main(){gl_FragColor=vec4(mix(vec3(.55,.78,.78),vec3(.76,.66,.49),vTail*.5),uOpacity*(1.-vTail*.5));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,transparent:true,depthWrite:false,fog:true
  });
}

export function mineralTexture(){
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const grain=Math.sin(x*12.9898+y*78.233)*43758.5453;
    const v=Math.round(155+24*Math.sin(x*.23+Math.sin(y*.08)*2)+12*(grain-Math.floor(grain)));
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(5,8);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}

// The same mineral runs through the column, its branching crown, and its roots.
// World coordinates keep that grain continuous across the separate pieces.
export function grownStone(texture, light) {
  const material = new THREE.MeshStandardMaterial({
    color: '#ab9986', roughness: .39, metalness: .27, bumpMap: texture, bumpScale: .048
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uTide = light.tide;
    shader.uniforms.uCrown = light.crown;
    shader.vertexShader = 'varying vec3 vStonePosition;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n vStonePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );
    shader.fragmentShader = 'varying vec3 vStonePosition; uniform float uTide, uCrown;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', `#include <color_fragment>
        vec3 pStone = vStonePosition;
        float grain = sin(pStone.x * 19. + pStone.z * 8. + .8 * sin(pStone.y * 2. + pStone.z * 4.));
        float thread = exp(-4.5 * abs(grain)) / (1. + fwidth(grain));
        float shoulder = smoothstep(5.7, 8.4, pStone.y);
        float foot = 1. - smoothstep(0., 1.5, pStone.y);
        float immersion = uTide * (1. - .84 * shoulder);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.055, .29, .24), .81 * immersion);
        diffuseColor.rgb *= .89 + .11 * grain;
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(.025, .76, .68) * immersion * (.28 + .66 * thread + .35 * foot);
        totalEmissiveRadiance += vec3(1., .42, .095) * uCrown * shoulder * (.16 + .32 * thread);
      `);
  };
  return material;
}

export function dropletTexture() {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
      const offset = (y * size + x) * 4;
      pixels.fill(255, offset, offset + 3);
      pixels[offset + 3] = Math.round(255 * Math.max(0, 1 - r) ** 1.25);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
