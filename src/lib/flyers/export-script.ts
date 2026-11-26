/**
 * Modos de dibujo para llevar un flyer al editor de capas:
 * - "background": todo menos los textos y el logo, que pasan a ser capas.
 * - "layers": mide cada texto (posición, tipografía, color y cortes de línea)
 *   y deja el resultado en body[data-layers], en base64.
 * Lo marcado con data-static queda en el fondo, como imagen.
 */
export type FlyerRenderMode = "normal" | "background" | "layers";

/** Textos que pasan a ser capas: todo menos lo marcado con data-static. */
const PICK_TEXTS = `
  function editableTexts(){
    var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);var found=[];var node;
    while((node=walker.nextNode())){
      var el=node.parentElement;
      if(node.textContent.trim()&&el&&!el.closest('[data-static],script,style,title'))found.push(node);
    }
    return found;
  }`;

export const BACKGROUND_CSS = `
.hub-hide{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}
svg .hub-hide{fill:transparent!important}
.brand img{visibility:hidden!important}`;

/**
 * Oculta solo los textos editables. Se envuelve cada texto en lugar de
 * ocultar su contenedor: si no, lo fijo que hereda el color (una hora, un
 * autor) también desaparecería.
 */
export const BACKGROUND_SCRIPT = `
document.fonts.ready.then(function(){${PICK_TEXTS}
  editableTexts().forEach(function(node){
    var el=node.parentElement;
    if(el.namespaceURI==='http://www.w3.org/2000/svg'){el.classList.add('hub-hide');return;}
    var span=document.createElement('span');span.className='hub-hide';
    node.parentNode.insertBefore(span,node);span.appendChild(node);
  });
});`;

/** Corre después del ajuste de tamaños, sobre la misma promesa de fuentes. */
export const LAYERS_SCRIPT = `
document.fonts.ready.then(function(){${PICK_TEXTS}
  function zoomOf(el){var z=1;while(el&&el.nodeType===1){var v=parseFloat(getComputedStyle(el).zoom);if(v&&v!==1)z*=v;el=el.parentElement;}return z;}
  function opacityOf(el){var o=1;while(el&&el.nodeType===1){o*=parseFloat(getComputedStyle(el).opacity)||1;el=el.parentElement;}return o;}
  function family(value){return value.split(',')[0].replace(/["']/g,'').trim();}
  var probe=document.createElement('canvas').getContext('2d');
  // El navegador centra el texto en la caja de la fuente; el canvas del editor,
  // en el cuadratín. Se devuelve el centro ya convertido al del editor.
  function shiftOf(style,weight,size,name){
    probe.font=style+' '+weight+' '+size+'px "'+name+'"';
    var m=probe.measureText('Hg');
    if(m.fontBoundingBoxAscent===undefined||m.emHeightAscent===undefined)return size*0.068;
    return ((m.fontBoundingBoxAscent-m.fontBoundingBoxDescent)-(m.emHeightAscent-m.emHeightDescent))/2;
  }
  var out=[];
  editableTexts().forEach(function(node){
    var el=node.parentElement;
    var cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none')return;
    var svg=el.ownerSVGElement||(el.tagName==='text'?el.closest('svg'):null);
    var scale=svg?svg.getScreenCTM().a:zoomOf(el);
    var size=parseFloat(cs.fontSize)*scale;
    var lines=[];var current=null;var re=/\\S+/g;var match;
    while((match=re.exec(node.textContent))){
      var range=document.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
      var rect=range.getClientRects()[0];
      if(!rect||!rect.width)continue;
      if(!current||Math.abs(rect.top-current.top)>rect.height*0.5){current={top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,words:[]};lines.push(current);}
      current.words.push(match[0]);
      current.left=Math.min(current.left,rect.left);current.right=Math.max(current.right,rect.right);current.bottom=Math.max(current.bottom,rect.bottom);
    }
    if(!lines.length)return;
    var centers=lines.map(function(line){return (line.top+line.bottom)/2;});
    var lineHeight=lines.length>1?(centers[centers.length-1]-centers[0])/(lines.length-1):(cs.lineHeight==='normal'?size*1.2:parseFloat(cs.lineHeight)*scale);
    var align=svg?(el.getAttribute('text-anchor')==='middle'?'center':'left'):(cs.textAlign==='center'?'center':(cs.textAlign==='right'||cs.textAlign==='end')?'right':'left');
    out.push({
      text:lines.map(function(line){return line.words.join(' ');}).join('\\n'),
      left:Math.min.apply(null,lines.map(function(line){return line.left;})),
      right:Math.max.apply(null,lines.map(function(line){return line.right;})),
      center:(centers[0]+centers[centers.length-1])/2+shiftOf(cs.fontStyle,parseInt(cs.fontWeight,10)||400,size,family(cs.fontFamily)),
      lineHeight:lineHeight,
      fontSize:size,
      fontFamily:family(cs.fontFamily),
      fontWeight:parseInt(cs.fontWeight,10)||400,
      fontStyle:cs.fontStyle==='italic'?'italic':'normal',
      color:svg?(cs.fill||cs.color):cs.color,
      letterSpacing:cs.letterSpacing==='normal'?0:parseFloat(cs.letterSpacing)*scale,
      align:align,
      opacity:opacityOf(el)
    });
  });
  var logos=[].slice.call(document.querySelectorAll('.brand img')).map(function(img){var r=img.getBoundingClientRect();return {src:img.getAttribute('src'),left:r.left,top:r.top,width:r.width,height:r.height};});
  var json=JSON.stringify({texts:out,logos:logos});
  document.body.setAttribute('data-layers',btoa(unescape(encodeURIComponent(json))));
});`;
