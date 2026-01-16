import{m as R}from"./mapbox-gl-BKwbCUZc.js";import{_ as j,r as A,w as Z,o as V,a as W,c as C,d as u,h as J,F as N,f as D,n as X,t as U,e as p,g as Y}from"./index-BlnXBglW.js";import{L as w,_ as m,p as T,U as L,M as k,G,a as K}from"./mapbox-overlay-2WIKvrwx.js";const B=new Uint8Array([0,255,255,255]),H={pickingSelectedColor:null,pickingHighlightColor:B,pickingActive:!1,pickingAttribute:!1};function Q(){let r=arguments.length>0&&arguments[0]!==void 0?arguments[0]:H;const e={};if(r.pickingSelectedColor!==void 0)if(!r.pickingSelectedColor)e.picking_uSelectedColorValid=0;else{const t=r.pickingSelectedColor.slice(0,3);e.picking_uSelectedColorValid=1,e.picking_uSelectedColor=t}if(r.pickingHighlightColor){const t=Array.from(r.pickingHighlightColor,l=>l/255);Number.isFinite(t[3])||(t[3]=1),e.picking_uHighlightColor=t}return r.pickingActive!==void 0&&(e.picking_uActive=!!r.pickingActive,e.picking_uAttribute=!!r.pickingAttribute),e}const $=`uniform bool picking_uActive;
uniform bool picking_uAttribute;
uniform vec3 picking_uSelectedColor;
uniform bool picking_uSelectedColorValid;

out vec4 picking_vRGBcolor_Avalid;

const float COLOR_SCALE = 1. / 255.;

bool picking_isColorValid(vec3 color) {
  return dot(color, vec3(1.0)) > 0.001;
}

bool isVertexPicked(vec3 vertexColor) {
  return
    picking_uSelectedColorValid &&
    !picking_isColorValid(abs(vertexColor - picking_uSelectedColor));
}

void picking_setPickingColor(vec3 pickingColor) {
  if (picking_uActive) {
    picking_vRGBcolor_Avalid.a = float(picking_isColorValid(pickingColor));

    if (!picking_uAttribute) {
      picking_vRGBcolor_Avalid.rgb = pickingColor * COLOR_SCALE;
    }
  } else {
    picking_vRGBcolor_Avalid.a = float(isVertexPicked(pickingColor));
  }
}

void picking_setPickingAttribute(float value) {
  if (picking_uAttribute) {
    picking_vRGBcolor_Avalid.r = value;
  }
}
void picking_setPickingAttribute(vec2 value) {
  if (picking_uAttribute) {
    picking_vRGBcolor_Avalid.rg = value;
  }
}
void picking_setPickingAttribute(vec3 value) {
  if (picking_uAttribute) {
    picking_vRGBcolor_Avalid.rgb = value;
  }
}
`,q=`uniform bool picking_uActive;
uniform vec3 picking_uSelectedColor;
uniform vec4 picking_uHighlightColor;

in vec4 picking_vRGBcolor_Avalid;
vec4 picking_filterHighlightColor(vec4 color) {
  if (picking_uActive) {
    return color;
  }
  bool selected = bool(picking_vRGBcolor_Avalid.a);

  if (selected) {
    float highLightAlpha = picking_uHighlightColor.a;
    float blendedAlpha = highLightAlpha + color.a * (1.0 - highLightAlpha);
    float highLightRatio = highLightAlpha / blendedAlpha;

    vec3 blendedRGB = mix(color.rgb, picking_uHighlightColor.rgb, highLightRatio);
    return vec4(blendedRGB, blendedAlpha);
  } else {
    return color;
  }
}
vec4 picking_filterPickingColor(vec4 color) {
  if (picking_uActive) {
    if (picking_vRGBcolor_Avalid.a == 0.0) {
      discard;
    }
    return picking_vRGBcolor_Avalid;
  }
  return color;
}
vec4 picking_filterColor(vec4 color) {
  vec4 highightColor = picking_filterHighlightColor(color);
  return picking_filterPickingColor(highightColor);
}

`,ee={name:"picking",vs:$,fs:q,getUniforms:Q},F={inject:{"vs:DECKGL_FILTER_GL_POSITION":`
    // for picking depth values
    picking_setPickingAttribute(position.z / position.w);
  `,"vs:DECKGL_FILTER_COLOR":`
  picking_setPickingColor(geometry.pickingColor);
  `,"fs:#decl":`
uniform bool picking_uAttribute;
  `,"fs:DECKGL_FILTER_COLOR":{order:99,injection:`
  // use highlight color if this fragment belongs to the selected object.
  color = picking_filterHighlightColor(color);

  // use picking color if rendering to picking FBO.
  color = picking_filterPickingColor(color);
    `}},...ee},ie=`#define SHADER_NAME arc-layer-vertex-shader

attribute vec3 positions;
attribute vec4 instanceSourceColors;
attribute vec4 instanceTargetColors;
attribute vec3 instanceSourcePositions;
attribute vec3 instanceSourcePositions64Low;
attribute vec3 instanceTargetPositions;
attribute vec3 instanceTargetPositions64Low;
attribute vec3 instancePickingColors;
attribute float instanceWidths;
attribute float instanceHeights;
attribute float instanceTilts;

uniform bool greatCircle;
uniform bool useShortestPath;
uniform float numSegments;
uniform float opacity;
uniform float widthScale;
uniform float widthMinPixels;
uniform float widthMaxPixels;
uniform int widthUnits;

varying vec4 vColor;
varying vec2 uv;
varying float isValid;

float paraboloid(float distance, float sourceZ, float targetZ, float ratio) {

  float deltaZ = targetZ - sourceZ;
  float dh = distance * instanceHeights;
  if (dh == 0.0) {
    return sourceZ + deltaZ * ratio;
  }
  float unitZ = deltaZ / dh;
  float p2 = unitZ * unitZ + 1.0;
  float dir = step(deltaZ, 0.0);
  float z0 = mix(sourceZ, targetZ, dir);
  float r = mix(ratio, 1.0 - ratio, dir);
  return sqrt(r * (p2 - r)) * dh + z0;
}
vec2 getExtrusionOffset(vec2 line_clipspace, float offset_direction, float width) {
  vec2 dir_screenspace = normalize(line_clipspace * project_uViewportSize);
  dir_screenspace = vec2(-dir_screenspace.y, dir_screenspace.x);

  return dir_screenspace * offset_direction * width / 2.0;
}

float getSegmentRatio(float index) {
  return smoothstep(0.0, 1.0, index / (numSegments - 1.0));
}

vec3 interpolateFlat(vec3 source, vec3 target, float segmentRatio) {
  float distance = length(source.xy - target.xy);
  float z = paraboloid(distance, source.z, target.z, segmentRatio);

  float tiltAngle = radians(instanceTilts);
  vec2 tiltDirection = normalize(target.xy - source.xy);
  vec2 tilt = vec2(-tiltDirection.y, tiltDirection.x) * z * sin(tiltAngle);

  return vec3(
    mix(source.xy, target.xy, segmentRatio) + tilt,
    z * cos(tiltAngle)
  );
}
float getAngularDist (vec2 source, vec2 target) {
  vec2 sourceRadians = radians(source);
  vec2 targetRadians = radians(target);
  vec2 sin_half_delta = sin((sourceRadians - targetRadians) / 2.0);
  vec2 shd_sq = sin_half_delta * sin_half_delta;

  float a = shd_sq.y + cos(sourceRadians.y) * cos(targetRadians.y) * shd_sq.x;
  return 2.0 * asin(sqrt(a));
}

vec3 interpolateGreatCircle(vec3 source, vec3 target, vec3 source3D, vec3 target3D, float angularDist, float t) {
  vec2 lngLat;
  if(abs(angularDist - PI) < 0.001) {
    lngLat = (1.0 - t) * source.xy + t * target.xy;
  } else {
    float a = sin((1.0 - t) * angularDist);
    float b = sin(t * angularDist);
    vec3 p = source3D.yxz * a + target3D.yxz * b;
    lngLat = degrees(vec2(atan(p.y, -p.x), atan(p.z, length(p.xy))));
  }

  float z = paraboloid(angularDist * EARTH_RADIUS, source.z, target.z, t);

  return vec3(lngLat, z);
}

void main(void) {
  geometry.worldPosition = instanceSourcePositions;
  geometry.worldPositionAlt = instanceTargetPositions;

  float segmentIndex = positions.x;
  float segmentRatio = getSegmentRatio(segmentIndex);
  float prevSegmentRatio = getSegmentRatio(max(0.0, segmentIndex - 1.0));
  float nextSegmentRatio = getSegmentRatio(min(numSegments - 1.0, segmentIndex + 1.0));
  float indexDir = mix(-1.0, 1.0, step(segmentIndex, 0.0));
  isValid = 1.0;

  uv = vec2(segmentRatio, positions.y);
  geometry.uv = uv;
  geometry.pickingColor = instancePickingColors;

  vec4 curr;
  vec4 next;
  vec3 source;
  vec3 target;

  if ((greatCircle || project_uProjectionMode == PROJECTION_MODE_GLOBE) && project_uCoordinateSystem == COORDINATE_SYSTEM_LNGLAT) {
    source = project_globe_(vec3(instanceSourcePositions.xy, 0.0));
    target = project_globe_(vec3(instanceTargetPositions.xy, 0.0));
    float angularDist = getAngularDist(instanceSourcePositions.xy, instanceTargetPositions.xy);

    vec3 prevPos = interpolateGreatCircle(instanceSourcePositions, instanceTargetPositions, source, target, angularDist, prevSegmentRatio);
    vec3 currPos = interpolateGreatCircle(instanceSourcePositions, instanceTargetPositions, source, target, angularDist, segmentRatio);
    vec3 nextPos = interpolateGreatCircle(instanceSourcePositions, instanceTargetPositions, source, target, angularDist, nextSegmentRatio);

    if (abs(currPos.x - prevPos.x) > 180.0) {
      indexDir = -1.0;
      isValid = 0.0;
    } else if (abs(currPos.x - nextPos.x) > 180.0) {
      indexDir = 1.0;
      isValid = 0.0;
    }
    nextPos = indexDir < 0.0 ? prevPos : nextPos;
    nextSegmentRatio = indexDir < 0.0 ? prevSegmentRatio : nextSegmentRatio;

    if (isValid == 0.0) {
      nextPos.x += nextPos.x > 0.0 ? -360.0 : 360.0;
      float t = ((currPos.x > 0.0 ? 180.0 : -180.0) - currPos.x) / (nextPos.x - currPos.x);
      currPos = mix(currPos, nextPos, t);
      segmentRatio = mix(segmentRatio, nextSegmentRatio, t);
    }

    vec3 currPos64Low = mix(instanceSourcePositions64Low, instanceTargetPositions64Low, segmentRatio);
    vec3 nextPos64Low = mix(instanceSourcePositions64Low, instanceTargetPositions64Low, nextSegmentRatio);
  
    curr = project_position_to_clipspace(currPos, currPos64Low, vec3(0.0), geometry.position);
    next = project_position_to_clipspace(nextPos, nextPos64Low, vec3(0.0));
  
  } else {
    vec3 source_world = instanceSourcePositions;
    vec3 target_world = instanceTargetPositions;
    if (useShortestPath) {
      source_world.x = mod(source_world.x + 180., 360.0) - 180.;
      target_world.x = mod(target_world.x + 180., 360.0) - 180.;

      float deltaLng = target_world.x - source_world.x;
      if (deltaLng > 180.) target_world.x -= 360.;
      if (deltaLng < -180.) source_world.x -= 360.;
    }
    source = project_position(source_world, instanceSourcePositions64Low);
    target = project_position(target_world, instanceTargetPositions64Low);
    float antiMeridianX = 0.0;

    if (useShortestPath) {
      if (project_uProjectionMode == PROJECTION_MODE_WEB_MERCATOR_AUTO_OFFSET) {
        antiMeridianX = -(project_uCoordinateOrigin.x + 180.) / 360. * TILE_SIZE;
      }
      float thresholdRatio = (antiMeridianX - source.x) / (target.x - source.x);

      if (prevSegmentRatio <= thresholdRatio && nextSegmentRatio > thresholdRatio) {
        isValid = 0.0;
        indexDir = sign(segmentRatio - thresholdRatio);
        segmentRatio = thresholdRatio;
      }
    }

    nextSegmentRatio = indexDir < 0.0 ? prevSegmentRatio : nextSegmentRatio;
    vec3 currPos = interpolateFlat(source, target, segmentRatio);
    vec3 nextPos = interpolateFlat(source, target, nextSegmentRatio);

    if (useShortestPath) {
      if (nextPos.x < antiMeridianX) {
        currPos.x += TILE_SIZE;
        nextPos.x += TILE_SIZE;
      }
    }

    curr = project_common_position_to_clipspace(vec4(currPos, 1.0));
    next = project_common_position_to_clipspace(vec4(nextPos, 1.0));
    geometry.position = vec4(currPos, 1.0);
  }
  float widthPixels = clamp(
    project_size_to_pixel(instanceWidths * widthScale, widthUnits),
    widthMinPixels, widthMaxPixels
  );
  vec3 offset = vec3(
    getExtrusionOffset((next.xy - curr.xy) * indexDir, positions.y, widthPixels),
    0.0);
  DECKGL_FILTER_SIZE(offset, geometry);
  DECKGL_FILTER_GL_POSITION(curr, geometry);
  gl_Position = curr + vec4(project_pixel_size_to_clipspace(offset.xy), 0.0, 0.0);

  vec4 color = mix(instanceSourceColors, instanceTargetColors, segmentRatio);
  vColor = vec4(color.rgb, color.a * opacity);
  DECKGL_FILTER_COLOR(vColor, geometry);
}
`,te=`#define SHADER_NAME arc-layer-fragment-shader

precision highp float;

varying vec4 vColor;
varying vec2 uv;
varying float isValid;

void main(void) {
  if (isValid == 0.0) {
    discard;
  }

  gl_FragColor = vColor;
  geometry.uv = uv;

  DECKGL_FILTER_COLOR(gl_FragColor, geometry);
}
`,h=[0,0,0,255],ne={getSourcePosition:{type:"accessor",value:r=>r.sourcePosition},getTargetPosition:{type:"accessor",value:r=>r.targetPosition},getSourceColor:{type:"accessor",value:h},getTargetColor:{type:"accessor",value:h},getWidth:{type:"accessor",value:1},getHeight:{type:"accessor",value:1},getTilt:{type:"accessor",value:0},greatCircle:!1,numSegments:{type:"number",value:50,min:1},widthUnits:"pixels",widthScale:{type:"number",value:1,min:0},widthMinPixels:{type:"number",value:0,min:0},widthMaxPixels:{type:"number",value:Number.MAX_SAFE_INTEGER,min:0}};class P extends w{constructor(...e){super(...e),m(this,"state",void 0)}getBounds(){var e;return(e=this.getAttributeManager())===null||e===void 0?void 0:e.getBounds(["instanceSourcePositions","instanceTargetPositions"])}getShaders(){return super.getShaders({vs:ie,fs:te,modules:[T,F]})}get wrapLongitude(){return!1}initializeState(){this.getAttributeManager().addInstanced({instanceSourcePositions:{size:3,type:5130,fp64:this.use64bitPositions(),transition:!0,accessor:"getSourcePosition"},instanceTargetPositions:{size:3,type:5130,fp64:this.use64bitPositions(),transition:!0,accessor:"getTargetPosition"},instanceSourceColors:{size:this.props.colorFormat.length,type:5121,normalized:!0,transition:!0,accessor:"getSourceColor",defaultValue:h},instanceTargetColors:{size:this.props.colorFormat.length,type:5121,normalized:!0,transition:!0,accessor:"getTargetColor",defaultValue:h},instanceWidths:{size:1,transition:!0,accessor:"getWidth",defaultValue:1},instanceHeights:{size:1,transition:!0,accessor:"getHeight",defaultValue:1},instanceTilts:{size:1,transition:!0,accessor:"getTilt",defaultValue:0}})}updateState(e){super.updateState(e);const{props:t,oldProps:l,changeFlags:g}=e;if(g.extensionsChanged||g.propsChanged&&t.numSegments!==l.numSegments){var o;const{gl:a}=this.context;(o=this.state.model)===null||o===void 0||o.delete(),this.state.model=this._getModel(a),this.getAttributeManager().invalidateAll()}}draw({uniforms:e}){const{widthUnits:t,widthScale:l,widthMinPixels:g,widthMaxPixels:o,greatCircle:a,wrapLongitude:d}=this.props;this.state.model.setUniforms(e).setUniforms({greatCircle:a,widthUnits:L[t],widthScale:l,widthMinPixels:g,widthMaxPixels:o,useShortestPath:d}).draw()}_getModel(e){const{id:t,numSegments:l}=this.props;let g=[];for(let a=0;a<l;a++)g=g.concat([a,1,0,a,-1,0]);const o=new k(e,{...this.getShaders(),id:t,geometry:new G({drawMode:5,attributes:{positions:new Float32Array(g)}}),isInstanced:!0});return o.setUniforms({numSegments:l}),o}}m(P,"layerName","ArcLayer");m(P,"defaultProps",ne);const oe=`#define SHADER_NAME scatterplot-layer-vertex-shader

attribute vec3 positions;

attribute vec3 instancePositions;
attribute vec3 instancePositions64Low;
attribute float instanceRadius;
attribute float instanceLineWidths;
attribute vec4 instanceFillColors;
attribute vec4 instanceLineColors;
attribute vec3 instancePickingColors;

uniform float opacity;
uniform float radiusScale;
uniform float radiusMinPixels;
uniform float radiusMaxPixels;
uniform float lineWidthScale;
uniform float lineWidthMinPixels;
uniform float lineWidthMaxPixels;
uniform float stroked;
uniform bool filled;
uniform bool antialiasing;
uniform bool billboard;
uniform int radiusUnits;
uniform int lineWidthUnits;

varying vec4 vFillColor;
varying vec4 vLineColor;
varying vec2 unitPosition;
varying float innerUnitRadius;
varying float outerRadiusPixels;


void main(void) {
  geometry.worldPosition = instancePositions;
  outerRadiusPixels = clamp(
    project_size_to_pixel(radiusScale * instanceRadius, radiusUnits),
    radiusMinPixels, radiusMaxPixels
  );
  float lineWidthPixels = clamp(
    project_size_to_pixel(lineWidthScale * instanceLineWidths, lineWidthUnits),
    lineWidthMinPixels, lineWidthMaxPixels
  );
  outerRadiusPixels += stroked * lineWidthPixels / 2.0;
  float edgePadding = antialiasing ? (outerRadiusPixels + SMOOTH_EDGE_RADIUS) / outerRadiusPixels : 1.0;
  unitPosition = edgePadding * positions.xy;
  geometry.uv = unitPosition;
  geometry.pickingColor = instancePickingColors;

  innerUnitRadius = 1.0 - stroked * lineWidthPixels / outerRadiusPixels;
  
  if (billboard) {
    gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, vec3(0.0), geometry.position);
    DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
    vec3 offset = edgePadding * positions * outerRadiusPixels;
    DECKGL_FILTER_SIZE(offset, geometry);
    gl_Position.xy += project_pixel_size_to_clipspace(offset.xy);
  } else {
    vec3 offset = edgePadding * positions * project_pixel_size(outerRadiusPixels);
    DECKGL_FILTER_SIZE(offset, geometry);
    gl_Position = project_position_to_clipspace(instancePositions, instancePositions64Low, offset, geometry.position);
    DECKGL_FILTER_GL_POSITION(gl_Position, geometry);
  }
  vFillColor = vec4(instanceFillColors.rgb, instanceFillColors.a * opacity);
  DECKGL_FILTER_COLOR(vFillColor, geometry);
  vLineColor = vec4(instanceLineColors.rgb, instanceLineColors.a * opacity);
  DECKGL_FILTER_COLOR(vLineColor, geometry);
}
`,se=`#define SHADER_NAME scatterplot-layer-fragment-shader

precision highp float;

uniform bool filled;
uniform float stroked;
uniform bool antialiasing;

varying vec4 vFillColor;
varying vec4 vLineColor;
varying vec2 unitPosition;
varying float innerUnitRadius;
varying float outerRadiusPixels;

void main(void) {
  geometry.uv = unitPosition;

  float distToCenter = length(unitPosition) * outerRadiusPixels;
  float inCircle = antialiasing ? 
    smoothedge(distToCenter, outerRadiusPixels) : 
    step(distToCenter, outerRadiusPixels);

  if (inCircle == 0.0) {
    discard;
  }

  if (stroked > 0.5) {
    float isLine = antialiasing ? 
      smoothedge(innerUnitRadius * outerRadiusPixels, distToCenter) :
      step(innerUnitRadius * outerRadiusPixels, distToCenter);

    if (filled) {
      gl_FragColor = mix(vFillColor, vLineColor, isLine);
    } else {
      if (isLine == 0.0) {
        discard;
      }
      gl_FragColor = vec4(vLineColor.rgb, vLineColor.a * isLine);
    }
  } else if (!filled) {
    discard;
  } else {
    gl_FragColor = vFillColor;
  }

  gl_FragColor.a *= inCircle;
  DECKGL_FILTER_COLOR(gl_FragColor, geometry);
}
`,S=[0,0,0,255],re={radiusUnits:"meters",radiusScale:{type:"number",min:0,value:1},radiusMinPixels:{type:"number",min:0,value:0},radiusMaxPixels:{type:"number",min:0,value:Number.MAX_SAFE_INTEGER},lineWidthUnits:"meters",lineWidthScale:{type:"number",min:0,value:1},lineWidthMinPixels:{type:"number",min:0,value:0},lineWidthMaxPixels:{type:"number",min:0,value:Number.MAX_SAFE_INTEGER},stroked:!1,filled:!0,billboard:!1,antialiasing:!0,getPosition:{type:"accessor",value:r=>r.position},getRadius:{type:"accessor",value:1},getFillColor:{type:"accessor",value:S},getLineColor:{type:"accessor",value:S},getLineWidth:{type:"accessor",value:1},strokeWidth:{deprecatedFor:"getLineWidth"},outline:{deprecatedFor:"stroked"},getColor:{deprecatedFor:["getFillColor","getLineColor"]}};class M extends w{getShaders(){return super.getShaders({vs:oe,fs:se,modules:[T,F]})}initializeState(){this.getAttributeManager().addInstanced({instancePositions:{size:3,type:5130,fp64:this.use64bitPositions(),transition:!0,accessor:"getPosition"},instanceRadius:{size:1,transition:!0,accessor:"getRadius",defaultValue:1},instanceFillColors:{size:this.props.colorFormat.length,transition:!0,normalized:!0,type:5121,accessor:"getFillColor",defaultValue:[0,0,0,255]},instanceLineColors:{size:this.props.colorFormat.length,transition:!0,normalized:!0,type:5121,accessor:"getLineColor",defaultValue:[0,0,0,255]},instanceLineWidths:{size:1,transition:!0,accessor:"getLineWidth",defaultValue:1}})}updateState(e){if(super.updateState(e),e.changeFlags.extensionsChanged){var t;const{gl:l}=this.context;(t=this.state.model)===null||t===void 0||t.delete(),this.state.model=this._getModel(l),this.getAttributeManager().invalidateAll()}}draw({uniforms:e}){const{radiusUnits:t,radiusScale:l,radiusMinPixels:g,radiusMaxPixels:o,stroked:a,filled:d,billboard:f,antialiasing:I,lineWidthUnits:x,lineWidthScale:b,lineWidthMinPixels:_,lineWidthMaxPixels:v}=this.props;this.state.model.setUniforms(e).setUniforms({stroked:a?1:0,filled:d,billboard:f,antialiasing:I,radiusUnits:L[t],radiusScale:l,radiusMinPixels:g,radiusMaxPixels:o,lineWidthUnits:L[x],lineWidthScale:b,lineWidthMinPixels:_,lineWidthMaxPixels:v}).draw()}_getModel(e){const t=[-1,-1,0,1,-1,0,1,1,0,-1,1,0];return new k(e,{...this.getShaders(),id:this.props.id,geometry:new G({drawMode:6,vertexCount:4,attributes:{positions:{size:3,value:new Float32Array(t)}}}),isInstanced:!0})}}m(M,"defaultProps",re);m(M,"layerName","ScatterplotLayer");const ae={class:"map-card"},le={class:"map-frame","aria-label":"Mapbox with Deck.GL ArcLayer"},ce={key:0,class:"map-legend","aria-hidden":"true"},ge={class:"legend-label"},ue={__name:"MapboxDeckArcLayer",setup(r){R.accessToken="pk.eyJ1IjoianVud2VuMS0yNCIsImEiOiJjbWhhOTB0OXgxaHhoMmxwdWFuajg0dTg4In0._dlzG_ciC_aQKohMPH9MbA";const e=A(null),t=A([]),l=A([]),g=A(1);let o,a,d;const f={"NOₓ":[239,68,68],"PM2.5":[251,191,36],VOC:[59,130,246],"SO₂":[14,165,233],Methane:[16,185,129],Benzene:[147,51,234]},I=i=>f[i]??[148,163,184],x=i=>{const n=i.reduce((s,c)=>(s[c.pollutant]=(s[c.pollutant]??0)+(Number(c.annualTons)||0),s),{});return Object.entries(n).sort((s,c)=>c[1]-s[1]).map(([s])=>({pollutant:s,color:`rgba(${I(s).join(", ")}, 0.95)`}))},b=()=>new P({id:"industrial-pollution-arcs",data:t.value,pickable:!0,autoHighlight:!0,highlightColor:[255,255,255,180],greatCircle:!0,widthUnits:"pixels",parameters:{depthTest:!1},getSourcePosition:i=>[i.sourceLon,i.sourceLat],getTargetPosition:i=>[i.targetLon,i.targetLat],getSourceColor:i=>[...I(i.pollutant),220],getTargetColor:i=>[...I(i.pollutant),90],getWidth:i=>2+6*Math.max(0,Number(i.annualTons)||0)/Math.max(1,g.value),getTilt:12}),_=()=>{const i=[];for(const n of t.value)i.push({lon:n.sourceLon,lat:n.sourceLat,role:"source",pollutant:n.pollutant}),i.push({lon:n.targetLon,lat:n.targetLat,role:"target",pollutant:n.pollutant});return new M({id:"industrial-endpoints",data:i,pickable:!1,radiusUnits:"pixels",parameters:{depthTest:!1},getPosition:n=>[n.lon,n.lat],getRadius:n=>n.role==="source"?6:4,getFillColor:n=>n.role==="source"?[255,255,255,180]:[...I(n.pollutant),200],stroked:!0,getLineColor:[17,24,39,200],lineWidthUnits:"pixels",getLineWidth:1})},v=()=>{if(a){if(!t.value.length){a.setProps({layers:[]});return}a.setProps({layers:[b(),_()],getTooltip:({object:i})=>i?{text:`${i.source} → ${i.target}
${i.pollutant} · ${Number(i.annualTons).toLocaleString()} t/yr`}:null})}};Z(t,i=>{i.length&&(l.value=x(i),v())},{immediate:!0});const E=async()=>{const i=new URL("data:application/json;base64,WwogIHsKICAgICJpZCI6ICJwb3J0LXNhbi1wZWRybyIsCiAgICAic291cmNlIjogIlBvcnQgb2YgTG9zIEFuZ2VsZXMiLAogICAgInRhcmdldCI6ICJTYW4gUGVkcm8iLAogICAgInBvbGx1dGFudCI6ICJOT+KCkyIsCiAgICAiYW5udWFsVG9ucyI6IDUyMCwKICAgICJzb3VyY2VMYXQiOiAzMy43MzIsCiAgICAic291cmNlTG9uIjogLTExOC4yNjUsCiAgICAidGFyZ2V0TGF0IjogMzMuNzM4LAogICAgInRhcmdldExvbiI6IC0xMTguMjkyCiAgfSwKICB7CiAgICAiaWQiOiAicG9ydC1sb25nLWJlYWNoIiwKICAgICJzb3VyY2UiOiAiUG9ydCBvZiBMb25nIEJlYWNoIiwKICAgICJ0YXJnZXQiOiAiTG9uZyBCZWFjaCIsCiAgICAicG9sbHV0YW50IjogIlBNMi41IiwKICAgICJhbm51YWxUb25zIjogNjEwLAogICAgInNvdXJjZUxhdCI6IDMzLjc1NSwKICAgICJzb3VyY2VMb24iOiAtMTE4LjIxNiwKICAgICJ0YXJnZXRMYXQiOiAzMy44MDYsCiAgICAidGFyZ2V0TG9uIjogLTExOC4xODkKICB9LAogIHsKICAgICJpZCI6ICJ2ZXJub24tZG93bnRvd24iLAogICAgInNvdXJjZSI6ICJWZXJub24gSW5kdXN0cmlhbCBCZWx0IiwKICAgICJ0YXJnZXQiOiAiRG93bnRvd24gTEEiLAogICAgInBvbGx1dGFudCI6ICJWT0MiLAogICAgImFubnVhbFRvbnMiOiA0MzAsCiAgICAic291cmNlTGF0IjogMzQuMDAzLAogICAgInNvdXJjZUxvbiI6IC0xMTguMjI2LAogICAgInRhcmdldExhdCI6IDM0LjA0MywKICAgICJ0YXJnZXRMb24iOiAtMTE4LjI1MQogIH0sCiAgewogICAgImlkIjogImVsLXNlZ3VuZG8taW5nbGV3b29kIiwKICAgICJzb3VyY2UiOiAiRWwgU2VndW5kbyBSZWZpbmVyeSBSb3ciLAogICAgInRhcmdldCI6ICJJbmdsZXdvb2QiLAogICAgInBvbGx1dGFudCI6ICJTT+KCgiIsCiAgICAiYW5udWFsVG9ucyI6IDI4MCwKICAgICJzb3VyY2VMYXQiOiAzMy45MjEsCiAgICAic291cmNlTG9uIjogLTExOC4zODgsCiAgICAidGFyZ2V0TGF0IjogMzMuOTYxLAogICAgInRhcmdldExvbiI6IC0xMTguMzUzCiAgfSwKICB7CiAgICAiaWQiOiAic3VuLXZhbGxleS1wYWNvaW1hIiwKICAgICJzb3VyY2UiOiAiU3VuIFZhbGxleSBMYW5kZmlsbCBDbHVzdGVyIiwKICAgICJ0YXJnZXQiOiAiUGFjb2ltYSIsCiAgICAicG9sbHV0YW50IjogIk1ldGhhbmUiLAogICAgImFubnVhbFRvbnMiOiAzNTAsCiAgICAic291cmNlTGF0IjogMzQuMjE0LAogICAgInNvdXJjZUxvbiI6IC0xMTguMzgxLAogICAgInRhcmdldExhdCI6IDM0LjI0OSwKICAgICJ0YXJnZXRMb24iOiAtMTE4LjQyNwogIH0sCiAgewogICAgImlkIjogImNhcnNvbi1jb21wdG9uIiwKICAgICJzb3VyY2UiOiAiQ2Fyc29uIFBldHJvY2hlbWljYWwgQ29tcGxleCIsCiAgICAidGFyZ2V0IjogIkNvbXB0b24iLAogICAgInBvbGx1dGFudCI6ICJCZW56ZW5lIiwKICAgICJhbm51YWxUb25zIjogMTkwLAogICAgInNvdXJjZUxhdCI6IDMzLjgxNSwKICAgICJzb3VyY2VMb24iOiAtMTE4LjIzOCwKICAgICJ0YXJnZXRMYXQiOiAzMy44OTQsCiAgICAidGFyZ2V0TG9uIjogLTExOC4yMjcKICB9LAogIHsKICAgICJpZCI6ICJ3aWxtaW5ndG9uLXdlc3QtbG9uZy1iZWFjaCIsCiAgICAic291cmNlIjogIldpbG1pbmd0b24gT2lsIFRlcm1pbmFscyIsCiAgICAidGFyZ2V0IjogIldlc3QgTG9uZyBCZWFjaCIsCiAgICAicG9sbHV0YW50IjogIlBNMi41IiwKICAgICJhbm51YWxUb25zIjogNDcwLAogICAgInNvdXJjZUxhdCI6IDMzLjc5LAogICAgInNvdXJjZUxvbiI6IC0xMTguMjYsCiAgICAidGFyZ2V0TGF0IjogMzMuODE5LAogICAgInRhcmdldExvbiI6IC0xMTguMjIyCiAgfSwKICB7CiAgICAiaWQiOiAibGF4LXdlc3RjaGVzdGVyIiwKICAgICJzb3VyY2UiOiAiTEFYIEZ1ZWxpbmcgT3BlcmF0aW9ucyIsCiAgICAidGFyZ2V0IjogIldlc3RjaGVzdGVyIiwKICAgICJwb2xsdXRhbnQiOiAiTk/igpMiLAogICAgImFubnVhbFRvbnMiOiAyNjAsCiAgICAic291cmNlTGF0IjogMzMuOTQxLAogICAgInNvdXJjZUxvbiI6IC0xMTguNDA5LAogICAgInRhcmdldExhdCI6IDMzLjk2MywKICAgICJ0YXJnZXRMb24iOiAtMTE4LjQwOAogIH0sCiAgewogICAgImlkIjogImh1bnRpbmd0b24tcGFyay1iZWxsLWdhcmRlbnMiLAogICAgInNvdXJjZSI6ICJIdW50aW5ndG9uIFBhcmsgTWV0YWwgRmluaXNoZXJzIiwKICAgICJ0YXJnZXQiOiAiQmVsbCBHYXJkZW5zIiwKICAgICJwb2xsdXRhbnQiOiAiVk9DIiwKICAgICJhbm51YWxUb25zIjogMzEwLAogICAgInNvdXJjZUxhdCI6IDMzLjk4MSwKICAgICJzb3VyY2VMb24iOiAtMTE4LjIyNSwKICAgICJ0YXJnZXRMYXQiOiAzMy45NjUsCiAgICAidGFyZ2V0TG9uIjogLTExOC4xNgogIH0sCiAgewogICAgImlkIjogImlyd2luZGFsZS1henVzYSIsCiAgICAic291cmNlIjogIklyd2luZGFsZSBBZ2dyZWdhdGUgUGxhbnRzIiwKICAgICJ0YXJnZXQiOiAiQXp1c2EiLAogICAgInBvbGx1dGFudCI6ICJQTTIuNSIsCiAgICAiYW5udWFsVG9ucyI6IDE4MCwKICAgICJzb3VyY2VMYXQiOiAzNC4xMSwKICAgICJzb3VyY2VMb24iOiAtMTE3LjkzLAogICAgInRhcmdldExhdCI6IDM0LjEzNCwKICAgICJ0YXJnZXRMb24iOiAtMTE3LjkxMQogIH0sCiAgewogICAgImlkIjogInNhbnRhLWZlLXNwcmluZ3MtcGljby1yaXZlcmEiLAogICAgInNvdXJjZSI6ICJTYW50YSBGZSBTcHJpbmdzIENoZW1pY2FsIFJvdyIsCiAgICAidGFyZ2V0IjogIlBpY28gUml2ZXJhIiwKICAgICJwb2xsdXRhbnQiOiAiQmVuemVuZSIsCiAgICAiYW5udWFsVG9ucyI6IDI0MCwKICAgICJzb3VyY2VMYXQiOiAzMy45MzEsCiAgICAic291cmNlTG9uIjogLTExOC4wNjYsCiAgICAidGFyZ2V0TGF0IjogMzMuOTg5LAogICAgInRhcmdldExvbiI6IC0xMTguMDk2CiAgfSwKICB7CiAgICAiaWQiOiAicG9ydGVyLXJhbmNoLWdyYW5hZGEtaGlsbHMiLAogICAgInNvdXJjZSI6ICJQb3J0ZXIgUmFuY2ggR2FzIFN0b3JhZ2UiLAogICAgInRhcmdldCI6ICJHcmFuYWRhIEhpbGxzIiwKICAgICJwb2xsdXRhbnQiOiAiTWV0aGFuZSIsCiAgICAiYW5udWFsVG9ucyI6IDUyMCwKICAgICJzb3VyY2VMYXQiOiAzNC4zMSwKICAgICJzb3VyY2VMb24iOiAtMTE4LjU1LAogICAgInRhcmdldExhdCI6IDM0LjI4LAogICAgInRhcmdldExvbiI6IC0xMTguNQogIH0KXQo=",import.meta.url),s=await(await fetch(i)).json();t.value=s.map(c=>({...c,annualTons:Number(c.annualTons),sourceLat:Number(c.sourceLat),sourceLon:Number(c.sourceLon),targetLat:Number(c.targetLat),targetLon:Number(c.targetLon)})),g.value=t.value.reduce((c,y)=>Math.max(c,y.annualTons||0),1)},O=()=>{e.value&&(o=new R.Map({container:e.value,style:"mapbox://styles/mapbox/dark-v11",center:[-118.28,34],zoom:9.3,minZoom:8.2,maxZoom:13.5}),o.on("load",()=>{try{const i=t.value.flatMap(s=>[s.sourceLon,s.targetLon]),n=t.value.flatMap(s=>[s.sourceLat,s.targetLat]);if(i.length&&n.length){const s=Math.min(...i),c=Math.max(...i),y=Math.min(...n),z=Math.max(...n);o.fitBounds([[s,y],[c,z]],{padding:40,duration:500})}}catch{}a=new K({layers:[],getTooltip:()=>null}),o.addControl(a),v()}))};return V(async()=>{await E(),O(),e.value&&(d=new ResizeObserver(()=>{o&&o.resize()}),d.observe(e.value))}),W(()=>{d&&e.value&&d.unobserve(e.value),o&&a&&o.removeControl(a),o&&(o.remove(),o=null)}),(i,n)=>(p(),C("section",ae,[n[1]||(n[1]=u("header",{class:"map-card__header"},[u("div",null,[u("h2",{class:"h5 mb-1"},"Pollution Transport Flows"),u("p",{class:"map-subhead mb-0"}," Deck.GL ArcLayer traces modeled pollutant drift from industrial hubs into nearby Los Angeles neighborhoods. ")])],-1)),u("div",le,[u("div",{ref_key:"mapContainer",ref:e,class:"mapbox-surface"},null,512),l.value.length?(p(),C("div",ce,[n[0]||(n[0]=u("p",{class:"legend-title"},"Pollutant",-1)),(p(!0),C(N,null,D(l.value,s=>(p(),C("div",{key:s.pollutant,class:"legend-item"},[u("span",{class:"legend-swatch",style:X({backgroundColor:s.color})},null,4),u("span",ge,U(s.pollutant),1)]))),128))])):J("",!0)])]))}},de=j(ue,[["__scopeId","data-v-28a9aadc"]]),Ie={class:"container"},ve={__name:"CityDeckFlowsPage",setup(r){return(e,t)=>(p(),C("div",Ie,[t[0]||(t[0]=u("header",{class:"mb-4"},[u("h1",{class:"h3 fw-semibold mb-1"},"Industrial Pollution Flows"),u("p",{class:"text-muted mb-0"}," Deck.GL ArcLayer reveals the directional transport of emissions from key industrial hubs to nearby Los Angeles neighborhoods along prevailing wind corridors. ")],-1)),Y(de)]))}};export{ve as default};
