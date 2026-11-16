/* Review page only. No learning state, sync API, audio or game engine. */
(async function () {
  'use strict';
  const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const json = async url => { const r=await fetch(url); if(!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); };
  const text = async url => { const r=await fetch(url); if(!r.ok) throw new Error(`${url}: ${r.status}`); return r.text(); };
  try {
    const embedded=$('#review-data');
    const bundle=embedded ? JSON.parse(embedded.textContent) : null;
    const [data, manifest, sheet, terrain] = bundle ? [bundle.data,bundle.manifest,bundle.sheet,bundle.terrain] : await Promise.all([
      json('../data/world-art.json'),json('../assets/postal/world-pixels/manifest.json'),text('../assets/postal/world-pixels/sprites.svg'),text('../assets/postal/sprites.svg')
    ]);
    if(data.contentScope!=='presentation-only'||data.playable!==false) throw new Error('그림 검토용 데이터가 아닙니다.');
    const defs=document.createElement('div');defs.setAttribute('aria-hidden','true');defs.style.cssText='position:absolute;width:0;height:0;overflow:hidden';defs.innerHTML=sheet+terrain;document.body.prepend(defs);
    const worlds=data.continents.flatMap(c=>c.worlds.map(w=>({...w,band:c.band}))), results={};let band='all';
    const sprite=(id,cls='pixel')=>`<svg class="${cls}" viewBox="0 0 16 16" width="64" height="64" aria-hidden="true"><use href="#${esc(id)}" xlink:href="#${esc(id)}" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16"/></svg>`;
    const lum=c=>{const a=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);return a.reduce((s,v,i)=>s+(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)*[.2126,.7152,.0722][i],0);};
    function scene(w) {
      const uses=[];
      for(let x=0;x<192;x+=16)uses.push(`<use href="#t-grass" x="${x}" y="16" width="16" height="16"/><use href="#t-path" x="${x}" y="24" width="16" height="16"/>`);
      w.bossSprites.forEach((id,i)=>uses.push(`<use href="#${id}" x="${12+i*30}" y="8" width="16" height="16"/>`));
      return `<div class="scene" style="${Object.entries(w.paletteVars).map(([k,v])=>`${k}:${v}`).join(';')}"><svg viewBox="0 0 192 32" aria-label="${esc(w.name)} 색과 길 무늬"><rect width="192" height="32" fill="var(--w-sky)"/>${uses.join('')}</svg></div>`;
    }
    function options(values){return values.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');}
    $('#worlds').innerHTML=worlds.map(w=>{
      const hi=Math.max(lum(w.palette.ground),lum(w.palette.path)),lo=Math.min(lum(w.palette.ground),lum(w.palette.path));
      return `<section class="world" data-world="${w.id}" data-band="${w.band}"><div class="world-head"><div><small>${w.id.toUpperCase()}</small><h2>${esc(w.name)}</h2></div><p>${esc(w.concept)}</p></div>${scene(w)}<div class="palettes"><div class="swatches">${Object.entries(w.palette).map(([k,v])=>`<span><i class="swatch" style="background:${v}"></i>${{sky:'하늘',ground:'땅',path:'길'}[k]} ${v}</span>`).join('')}</div><p class="contrast">길·땅 기본색 명암비 ${((hi+.05)/(lo+.05)).toFixed(2)}:1 · 밝고 어두운 무늬는 위 풍경에서 확인</p><details class="palette-details"><summary>색 변수 8개</summary><dl>${Object.entries(w.paletteVars).map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></details></div><div class="boss-grid">${w.bossSprites.map(id=>{
        const s=manifest.symbols[id];results[id]={native:'unreviewed',pixel:'unreviewed'};
        return `<article class="boss" data-sprite="${id}"><h4>${esc(s.label)}</h4><div class="compare"><figure><span class="native">${s.emoji}</span><figcaption>기기 이모지</figcaption></figure><figure><canvas width="16" height="16" data-emoji="${s.emoji}" aria-label="기존 방식 확대"></canvas><figcaption>기존 16픽셀 확대</figcaption></figure><figure>${sprite(id)}<figcaption>새 픽셀 도안</figcaption></figure></div><div class="code">${id}</div><label>기기 이모지<select data-kind="native" aria-label="${esc(s.label)} 기기 이모지">${options([['unreviewed','미확인'],['pass','정상 표시'],['missing','빈칸·네모로 표시'],['unclear','그림 구별 어려움']])}</select></label><label>새 픽셀 도안<select data-kind="pixel" aria-label="${esc(s.label)} 새 픽셀 도안">${options([['unreviewed','미확인'],['pass','잘 보이고 구별됨'],['missing','그림이 보이지 않음'],['unclear','다듬기 필요']])}</select></label></article>`;
      }).join('')}</div></section>`;
    }).join('');
    document.querySelectorAll('canvas[data-emoji]').forEach(c=>{const x=c.getContext('2d');x.font='13px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(c.dataset.emoji,8,9);});
    $('#decor .decor-grid').innerHTML=Object.keys(manifest.decorations).map(id=>`<figure>${sprite(id)}<figcaption>${esc(manifest.symbols[id].label)}<br><small>${id}</small></figcaption></figure>`).join('');
    $('#storm .storm-grid').innerHTML=['fx-storm-a','fx-storm-b','fx-storm-letters','fx-storm-gone'].map(id=>`<figure><div class="storm-pair"><div class="storm-light">${sprite(id)}</div><div class="storm-dark">${sprite(id)}</div></div><figcaption>${esc(manifest.symbols[id].label)}<br><small>${id}</small></figcaption></figure>`).join('');
    function flagged(v){return ['missing','unclear'].includes(v.native)||['missing','unclear'].includes(v.pixel);}
    function refresh(){
      document.querySelectorAll('.world').forEach(el=>{
        let visible=0;el.querySelectorAll('.boss').forEach(b=>{const v=results[b.dataset.sprite],bad=flagged(v);b.classList.toggle('flagged',bad);b.hidden=$('#issues').checked&&!bad;if(!b.hidden)visible++;});
        el.hidden=(band!=='all'&&el.dataset.band!==band)||!visible;
      });
      const vals=Object.values(results),reviewed=vals.filter(v=>v.native!=='unreviewed'||v.pixel!=='unreviewed').length;
      $('#status').textContent=`180개 중 ${reviewed}개 검토 표시 · 확인 필요 ${vals.filter(flagged).length}개 · 이 페이지의 선택만 저장됩니다.`;
    }
    document.querySelectorAll('button[data-band]').forEach(b=>b.addEventListener('click',()=>{band=b.dataset.band;document.querySelectorAll('button[data-band]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));refresh();}));
    $('#issues').addEventListener('change',refresh);
    $('#worlds').addEventListener('change',e=>{if(!e.target.matches('select[data-kind]'))return;const b=e.target.closest('.boss');results[b.dataset.sprite][e.target.dataset.kind]=e.target.value;refresh();});
    $('#export').addEventListener('click',()=>{
      if(!$('#device').value.trim()){$('#status').textContent='결과를 구별할 수 있도록 기기와 OS를 적어 주세요.';$('#device').focus();return;}
      const report={version:1,assetVersion:manifest.version,sourceSha256:data.source.sha256,device:$('#device').value.trim(),userAgent:navigator.userAgent,createdAt:new Date().toISOString(),method:'manual-user-selections',automaticDeviceCertification:false,
        results:Object.entries(results).map(([id,r])=>({id,worldId:manifest.symbols[id].worldId,emoji:manifest.symbols[id].emoji,label:manifest.symbols[id].label,...r}))};
      const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='world-pixel-review.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    });
    refresh();document.body.dataset.ready='true';
  }catch(e){$('#error').hidden=false;$('#error').textContent=`자료를 열지 못했습니다: ${e.message}. Mac의 게임 서버에서 /art-review/를 열거나 단일 HTML 파일을 사용하세요.`;$('#status').textContent='불러오기 실패';}
}());
