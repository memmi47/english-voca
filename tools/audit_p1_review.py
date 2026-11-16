"""Parent review lists from P1; never edits reference data or applies suggestions."""
from pathlib import Path
import argparse, collections, csv, hashlib, io, json, re, unicodedata
ROOT=Path(__file__).resolve().parents[1]
# Existing data_audit.md examples. These are proposals, not confirmed corrections.
SUGGESTIONS={
 'light':['빛'],'water':['물'],'color':['색'],'name':['이름'],'reason':['이유'],'free':['자유로운','무료의'],
 'top':['꼭대기'],'question':['질문'],'plan':['계획'],'test':['시험'],'plant':['식물'],'stick':['막대기'],
 'deal':['거래','다루다'],'surprise':['놀라움','깜짝 선물'],'orange':['오렌지'],'step':['걸음'],
 'face':['얼굴'],'circle':['원'],'product':['제품'],'area':['지역'],'state':['상태'],'note':['메모'],
 'mind':['마음'],'correct':['올바른'],'type':['종류'],'interest':['관심']}
PIC_REVIEW={'fly','watch','ring','orange'}
def norm(s):return ' '.join(unicodedata.normalize('NFC',s).split())
def md(s):return str(s).replace('|','\\|').replace('\n',' ')
def build():
    source=ROOT/'reference/weekly-tool/vocabulary.json';db=json.loads(source.read_text());sha=hashlib.sha256(source.read_bytes()).hexdigest()
    lemmas={l['id']:l for l in db['lemmas'] if l['track'] in ('vocab','sight') and l['old_priority'] in ('P1','P2','P3')}
    p1={lid:l for lid,l in lemmas.items() if l['old_priority']=='P1'};assert len(p1)==1215
    bylemma=collections.defaultdict(list)
    for c in db['cards']:bylemma[c['lemma_link']].append(c)
    basic={lid:sorted([c for c in bylemma[lid] if c['kind']=='기본'],key=lambda c:c['sense_order']) for lid in lemmas}
    assert all(cs and cs[0]['sense_order']==1 for cs in basic.values())
    candidates=[];inventory=[];past=[]
    for lid,l in sorted(p1.items()):
        cs=basic[lid];first=cs[0];alts=[dict(cardId=c['card_id'],ko=c['single_meaning_ko']) for c in cs[1:]]
        flags=[]
        targets=[a for a in alts if a['ko'] in SUGGESTIONS.get(l['form'],[])]
        if targets:
            flags.append('first-sense-proposal')
            candidates.append(dict(lemmaId=lid,form=l['form'],currentCardId=first['card_id'],currentKo=first['single_meaning_ko'],suggestedCards=targets,
                basis='docs/research/data_audit.md 4절의 제안. 일상적인 첫 뜻인지 부모 확인 필요.',status='unreviewed',applied=False))
        if l['form'] in PIC_REVIEW:flags.append('picture-sense-review')
        if l['track']=='sight':flags.append('sight-empty-gloss-use-listening')
        if len(cs)>1:flags.append('multiple-senses')
        inventory.append(dict(lemmaId=lid,form=l['form'],cardId=first['card_id'],ko=first['single_meaning_ko'],track=l['track'],flags=flags,alternatives=alts,status='unreviewed'))
        for c in bylemma[lid]:
            if c['kind']=='불규칙 과거형':past.append(dict(cardId=c['card_id'],form=c['card_form'],lemmaId=lid,baseForm=l['form'],ko=c['single_meaning_ko'],baseKo=first['single_meaning_ko'],sameAsBase=norm(c['single_meaning_ko'])==norm(first['single_meaning_ko']),status='unreviewed',applied=False))
    gloss=collections.defaultdict(list)
    for lid,cs in basic.items():
        key=norm(cs[0]['single_meaning_ko'])
        if key:gloss[key].append(dict(cardId=cs[0]['card_id'],form=lemmas[lid]['form'],band=lemmas[lid]['old_priority']))
    shared=[dict(ko=key,members=members) for key,members in sorted(gloss.items()) if len(members)>1 and any(m['band']=='P1' for m in members)]
    data=dict(source=dict(path='reference/weekly-tool/vocabulary.json',sha256=sha),status='parent-review-required',overridesApplied=0,
        counts=dict(p1=len(inventory),senseProposals=len(candidates),pastCards=len(past),pastSameAsBase=sum(c['sameAsBase'] for c in past),sharedGlossGroups=len(shared),pictureReview=sum('picture-sense-review' in c['flags'] for c in inventory)),
        firstSenseProposals=candidates,pastReview=past,sharedGlossGroups=shared,p1Inventory=inventory)
    buf=io.StringIO();writer=csv.writer(buf,lineterminator="\n");writer.writerow(['lemma_id','form','current_card_id','current_ko','track','flags','alternative_cards','parent_decision'])
    for c in inventory:writer.writerow([c['lemmaId'],c['form'],c['cardId'],c['ko'],c['track'],'; '.join(c['flags']),'; '.join(a['cardId']+' = '+a['ko'] for a in c['alternatives']),'미확인'])
    cnt=data['counts'];lines=['# P1 부모 검토 목록','',f'원본 SHA-256: `{sha}`','',
        f'[verified] P1 **{cnt["p1"]}개**를 전수 목록화했다. 기존 감사의 첫 뜻 변경 후보 **{cnt["senseProposals"]}개**, P1 원형에 연결된 불규칙 과거 **{cnt["pastCards"]}장**(첫 뜻과 같은 것 **{cnt["pastSameAsBase"]}장**), P1이 포함된 동일 한글 뜻 **{cnt["sharedGlossGroups"]}묶음**, 그림·첫 뜻 검토 **{cnt["pictureReview"]}개**다.',
        '', '**원본과 대표 뜻은 변경하지 않았다.** 후보는 [estimate] 부모 확인용 제안이며 확정 오류 목록이 아니다. 과거형은 이번 4,610개 대표 카드 배정 밖이다. 전체 P1 1,215개에 대해 사람이 뜻의 적절성을 검수했다는 주장은 하지 않는다.',
        '', '검토 파일: `p1_review.json`(전체 ID·후보·과거·동일 뜻), `p1_review.csv`(1,215행, 부모 결정란). CSV는 UTF-8 BOM으로 저장해 한글을 보존한다. 현재 결정은 모두 미확인이다.',
        '', '## 첫 뜻 검토 후보', '', '| 표제어 | 현재 대표 카드 / 뜻 | 제안 카드 / 뜻 |','|---|---|---|']
    for c in candidates:lines.append(f'| {md(c["form"])} | `{c["currentCardId"]}` {md(c["currentKo"])} | '+' / '.join('`'+a['cardId']+'` '+md(a['ko']) for a in c['suggestedCards'])+' |')
    lines+=['','제안 중 하나를 부모가 확인하면 `tools/worlds/overrides.json`의 entries에 `lemmaId,cardId,reason,approvedByParent:true`를 기록하고 version을 올린 뒤 세계를 다시 생성한다. 승인 없이 후보를 자동 적용하지 않는다. 새 card_id의 음원도 확인해야 한다.','','## 불규칙 과거 검토','', '| 과거 카드 | 원형 | 현재 뜻 | 원형 첫 뜻과 같음 |','|---|---|---|---|']
    for c in past:lines.append(f'| `{c["cardId"]}` ({md(c["form"])}) | {md(c["baseForm"])} | {md(c["ko"])} | {"예" if c["sameAsBase"] else "아니오"} |')
    lines+=['','같은 뜻을 무조건 문자열 치환하지 않는다. dealt=약속처럼 명사 뜻이 복사된 사례는 원형의 뜻부터 확인해야 한다. 이미 과거형으로 적힌 사례도 함께 표시해 누락을 막는다.','','## 같은 한글 뜻 묶음','', '빈 뜻의 기능어는 동일 뜻 그룹으로 묶지 않는다. 여기서는 P1과 같은 뜻을 가진 P2/P3 대표 카드도 함께 보여 준다. NFC·공백 정규화만 적용했으며 유사한 의미 전부를 찾은 목록은 아니다.','','| 뜻 | 대표 카드 |','|---|---|']
    for g in shared:lines.append('| '+md(g['ko'])+' | '+' / '.join(f'{md(c["form"])} ({c["band"]}, `{c["cardId"]}`)' for c in g['members'])+' |')
    lines+=['','## 그림과 학습 연결','', 'fly(날다/파리 그림), watch(지켜보다/손목시계), ring(울리다/반지), orange(주황색의/과일)는 기존 감사의 그림-뜻 불일치 후보다. 새 전체 catalogue는 의미별 확인 전 어휘 이모지를 빈 값으로 둔다. 세계 도안은 별개이며 카드 정답을 미리 드러내는 그림으로 연결하지 않는다.','','재현: `python3 -I tools/audit_p1_review.py --check`. 결과는 검토 자료이며 자동 승인 파일이 아니다.','']
    return {'p1_review.json':json.dumps(data,ensure_ascii=False,indent=2)+'\n','p1_review.csv':'\ufeff'+buf.getvalue(),'p1_review.md':'\n'.join(lines)},cnt
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'docs/research');p.add_argument('--check',action='store_true');args=p.parse_args();files,counts=build()
    for name,content in files.items():
        path=args.output/name
        if path.resolve().is_relative_to((ROOT/'reference').resolve()):raise SystemExit('reference is read-only')
        if args.check:
            if not path.exists() or path.read_text(encoding='utf-8')!=content:raise SystemExit(f'stale: {path}')
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content,encoding='utf-8',newline='')
    print(json.dumps(counts,ensure_ascii=False))
