import * as THREE from 'three';

// Scene-bound light and plankton: these are ambient currents, not music analysis.
export class PalaceAtmosphere {
  constructor(scene,random){
    this.scene=scene;this.rays=[];this.halos=[];
    this.sea = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vDirection;
        void main() {
          vDirection = position;
          vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
          gl_Position = clip.xyww;
        }`,
      fragmentShader: `varying vec3 vDirection; uniform float uTime;
        void main() {
          vec3 d = normalize(vDirection);
          float time = uTime * .045;
          float sides = smoothstep(.10, .86, abs(d.x));
          float overhead = smoothstep(-.38, .78, d.y);
          vec3 water = mix(vec3(.005,.012,.024), vec3(.031,.079,.13), overhead);
          float arc = d.y - .13 - .17*d.x*d.x + .047*sin(7.*d.x+3.*d.z+time);
          float shelf = exp(-abs(arc)*18.) + .45*exp(-abs(arc-.129)*25.);
          vec2 surface = d.xz / max(.16, d.y+.23);
          float swell = sin(surface.x*4.7 + .8*sin(surface.y*3.4+time));
          float silk = .5+.5*sin(surface.y*6.2 + swell*1.32 - time);
          float fleck = pow(silk, 5.) / (1.+length(fwidth(surface))*4.);
          water += sides*shelf*vec3(.013,.041,.058)*(.42+.58*fleck);
          water += (sides*.5+.5)*smoothstep(.24,.88,d.y)*fleck*vec3(.025,.068,.084);
          gl_FragColor = vec4(water, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const seaDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), this.sea);
    seaDome.frustumCulled = false;
    seaDome.renderOrder = -1000;
    scene.add(seaDome);
    const glow=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color('#58afbb')},uOpacity:{value:.11}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform vec3 uColor;uniform float uOpacity;void main(){vec2 p=vUv*2.-1.;float a=exp(-dot(p,p)*4.)*(1.-smoothstep(.6,1.,length(p)));gl_FragColor=vec4(uColor,a*uOpacity);}'
    });
    // Light is placed between bays; it does not lift the entire ocean to gray.
    for(let i=0;i<5;i++){
      const mat=glow.clone();mat.uniforms.uOpacity.value=.021+i*.003;
      const halo=new THREE.Mesh(new THREE.PlaneGeometry(30,17),mat);halo.position.set(0,7,-13-i*13);halo.renderOrder=-1;scene.add(halo);this.halos.push(halo);
    }
    const shaft=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uOpacity:{value:.045}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform float uTime,uOpacity;void main(){float edge=pow(max(0.,sin(vUv.x*3.14159265)),3.);float fall=sin(vUv.y*3.14159265);float current=.8+.2*sin(vUv.y*5.+uTime*.18);gl_FragColor=vec4(.36,.66,.69,edge*fall*current*uOpacity);}'
    });
    for(let i=0;i<10;i++){
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.6+random()*1.2,17),shaft);mesh.position.set((i%2?1:-1)*(4.4+random()*5),6,4-Math.floor(i/2)*14);mesh.rotation.z=(i%2?1:-1)*.22;mesh.rotation.y=(random()-.5)*.5;scene.add(mesh);this.rays.push(mesh);
    }
    this.shaftMaterial=shaft;
    const count=640,p=[],seed=[];
    for(let i=0;i<count;i++){p.push((random()-.5)*30,random()*14,-76+random()*95);seed.push(random(),random());}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('aSeed',new THREE.Float32BufferAttribute(seed,2));
    this.particles=new THREE.Points(geo,new THREE.ShaderMaterial({uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uTime:{value:0},uPixelRatio:{value:1},uOpacity:{value:.48}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:true,
      vertexShader:`attribute vec2 aSeed;uniform float uTime,uPixelRatio;varying float vAlpha;
        #include <fog_pars_vertex>
        void main(){vec3 p=position;p.x+=sin(uTime*.08+aSeed.x*30.)*.7;p.y=mod(p.y+uTime*(.025+aSeed.y*.045),14.);p.z+=sin(uTime*.06+aSeed.y*30.)*.6;vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp((15.+aSeed.x*20.)*uPixelRatio/max(-mvPosition.z,1.),1.,6.);vAlpha=.35+.65*aSeed.y;
        #include <fog_vertex>
        }`,
      fragmentShader:`uniform float uOpacity;varying float vAlpha;
        #include <fog_pars_fragment>
        void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.07,.5,d);gl_FragColor=vec4(.61,.83,.80,a*a*vAlpha*uOpacity);
        #include <fog_fragment>
        }`
    }));scene.add(this.particles);
  }
  update(time,pixelRatio=1){this.sea.uniforms.uTime.value=time;this.shaftMaterial.uniforms.uTime.value=time;this.particles.material.uniforms.uTime.value=time;this.particles.material.uniforms.uPixelRatio.value=pixelRatio;}
}
