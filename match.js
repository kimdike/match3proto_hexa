// ── 헥사 3매치 퍼즐: 매칭 감지/특수판정/점수 ──
// config.js, grid.js, board.js 다음, game.js 이전에 로드

// ── 점수 계산 ──
function calcLineScore(len) {
  if(len===3) return CFG.score3match; if(len===4) return CFG.score4match;
  if(len===5) return CFG.score5match; return len*200;
}
function calcComboBonus(combo) {
  if(combo===2) return CFG.combo2bonus; if(combo===3) return CFG.combo3bonus;
  if(combo>=4) return CFG.combo4bonus; return 0;
}

// ── 매치 감지 ──
function countLine(col,row,dir,color){
  let n=0,pos=step(col,row,dir);
  while(pos&&getColor(pos[0],pos[1])===color){n++;pos=step(pos[0],pos[1],dir);}
  return n;
}
function hasMatchAt(col,row){
  const color=getColor(col,row); if(color===null) return false;
  for(const [a,b] of AXES) if(1+countLine(col,row,a,color)+countLine(col,row,b,color)>=3) return true;
  return false;
}
function findAllMatches(){
  const lines=[],visited=new Set();
  for(let col=0;col<COLS_PATTERN.length;col++)
    for(let row=0;row<COLS_PATTERN[col];row++){
      const color=getColor(col,row); if(color===null) continue;
      for(const [dirA,dirB] of AXES){
        const line=[[col,row]];
        let pos=step(col,row,dirA);
        while(pos&&getColor(pos[0],pos[1])===color){line.push(pos);pos=step(pos[0],pos[1],dirA);}
        pos=step(col,row,dirB);
        while(pos&&getColor(pos[0],pos[1])===color){line.push(pos);pos=step(pos[0],pos[1],dirB);}
        if(line.length>=3){
          const key=dirA+'-'+line.map(([c,r])=>`${c},${r}`).sort().join('|');
          if(!visited.has(key)){visited.add(key);lines.push(line);}
        }
      }
    }
  const cellSet=new Set();
  for(const l of lines) l.forEach(([c,r])=>cellSet.add(`${c},${r}`));

  // 타겟볼 감지: 3가지 평행사변형 패턴 (4셀) + 확장 (5셀)
  // 평행사변형 = 기준점에서 두 방향(dirA, dirB)으로 각각 1칸 + 대각(dirA+dirB) 1칸
  const clusters=[];
  const foundKeys=new Set(); // 중복 방지
  // 3가지 방향 쌍: (up,ne), (up,nw), (ne,nw)
  const paraDirs=[['up','ne'],['up','nw'],['ne','nw']];
  for(let col=0;col<COLS_PATTERN.length;col++){
    for(let row=0;row<COLS_PATTERN[col];row++){
      const cell=board[col][row];
      if(!cell||cell.type!=='normal') continue;
      const color=cell.color;
      for(const [dA,dB] of paraDirs){
        // 기준점(col,row) → dA → dB → dA+dB (4셀 평행사변형)
        const pA=step(col,row,dA); if(!pA) continue;
        const pB=step(col,row,dB); if(!pB) continue;
        const pAB=step(pA[0],pA[1],dB); if(!pAB) continue;
        // 4셀 모두 같은 색 normal인지 확인
        const check=(c,r)=>{const cc=board[c]?.[r];return cc&&cc.type==='normal'&&cc.color===color;};
        if(!check(pA[0],pA[1])||!check(pB[0],pB[1])||!check(pAB[0],pAB[1])) continue;
        const base=[[col,row],pA,pB,pAB];
        const key=base.map(([c,r])=>`${c},${r}`).sort().join('|');
        if(foundKeys.has(key)) continue;
        foundKeys.add(key);
        // 확장: base 4셀에 인접한 같은 색 블록 1개 추가 (5셀)
        const baseSet=new Set(base.map(([c,r])=>`${c},${r}`));
        let extended=null;
        for(const [bc,br] of base){
          for(const [nc,nr] of getNeighbors(bc,br)){
            const nk=`${nc},${nr}`;
            if(baseSet.has(nk)) continue;
            if(check(nc,nr)){
              const extCells=[...base,[nc,nr]];
              const extKey=extCells.map(([c,r])=>`${c},${r}`).sort().join('|');
              if(!foundKeys.has(extKey)){
                foundKeys.add(extKey);
                extended={color,cells:extCells,size:5};
              }
              break;
            }
          }
          if(extended) break;
        }
        // 확장 5셀 우선, 없으면 기본 4셀
        clusters.push(extended||{color,cells:base,size:base.length});
      }
    }
  }

  return {lines,cells:[...cellSet].map(k=>k.split(',').map(Number)),clusters};
}

// ── 연결 그룹 탐색 (같은 색 매치셀 인접 연결) ──
function findConnectedGroups(matchedCells){
  const byColor={};
  for(const [c,r] of matchedCells){
    const color=getColor(c,r); if(color===null) continue;
    if(!byColor[color]) byColor[color]=[];
    byColor[color].push([c,r]);
  }
  const results=[];
  for(const [color,cells] of Object.entries(byColor)){
    if(cells.length<4) continue;
    const keySet=new Set(cells.map(([c,r])=>`${c},${r}`));
    const visited=new Set();
    for(const [sc,sr] of cells){
      const sk=`${sc},${sr}`; if(visited.has(sk)) continue;
      const group=[],stk=[[sc,sr]];
      while(stk.length){
        const [c,r]=stk.pop(),k=`${c},${r}`;
        if(visited.has(k)||!keySet.has(k)) continue;
        visited.add(k); group.push([c,r]);
        for(const [nc,nr] of getNeighbors(c,r)) stk.push([nc,nr]);
      }
      if(group.length<4) continue;
      // 그룹 내 최대 직선 길이 계산
      const groupSet=new Set(group.map(([c,r])=>`${c},${r}`));
      let maxLine=0;
      for(const [dirA,dirB] of AXES){
        for(const [gc,gr] of group){
          let len=1;
          let pos=step(gc,gr,dirA);
          while(pos&&groupSet.has(`${pos[0]},${pos[1]}`)){len++;pos=step(pos[0],pos[1],dirA);}
          pos=step(gc,gr,dirB);
          while(pos&&groupSet.has(`${pos[0]},${pos[1]}`)){len++;pos=step(pos[0],pos[1],dirB);}
          if(len>maxLine) maxLine=len;
        }
      }
      const isStraight=maxLine===group.length; // 전체가 1자 직선
      const hasLine=maxLine>=3;                 // 3+ 직선 포함 여부
      results.push({color:parseInt(color),cells:group,isStraight,hasLine,size:group.length});
    }
  }
  return results;
}

// ── 특수블록 생성 판정 (우선순위: 무지개 > 폭탄 > 줄볼 > 타겟볼) ──
function determineSpecial(curLines,curCells,clusters,isFirst,originCol,originRow,destCol,destRow,swapDir){
  // 1) 후보 라인을 찾는다
  let bestLine5=null,bestLine4=null;
  for(const line of curLines){
    if(line.length>=5 && !bestLine5) bestLine5=line;
    if(line.length>=4 && !bestLine4) bestLine4=line;
  }
  // 2) 라인 매치 셀로 연결 그룹 (폭탄볼용: 교차/겹침 라인으로 5+셀 비직선)
  const lineGroups=findConnectedGroups(curCells);
  let bombGroup=null;
  for(const g of lineGroups){
    if(g.size>=5 && !g.isStraight && !bombGroup) bombGroup=g;
  }
  // 3) BFS 클러스터 (타겟볼용: findAllMatches에서 이미 자격 필터링됨)
  let targetGroup=null;
  if(clusters.length>0) targetGroup=clusters[0];

  function getSwapPivot(cells){
    if(!isFirst) return null;
    const swapSet=new Set([`${originCol},${originRow}`, `${destCol},${destRow}`]);
    const inSwap=cells.filter(([c,r])=>swapSet.has(`${c},${r}`));
    if(inSwap.length===1) return {col:inSwap[0][0],row:inSwap[0][1]};
    if(inSwap.length===2){
      let sumx=0,sumy=0;
      cells.forEach(([c,r])=>{const p=getBlockPos(c,r);sumx+=p.x;sumy+=p.y;});
      const center={x:sumx/cells.length,y:sumy/cells.length};
      let best=null,bestD=Infinity;
      for(const [c,r] of inSwap){
        const p=getBlockPos(c,r);
        const d=(p.x-center.x)**2+(p.y-center.y)**2;
        if(d<bestD){bestD=d;best={col:c,row:r};}
      }
      return best;
    }
    return null;
  }

  function choosePivot(cells){
    if(!cells||cells.length===0) return null;
    const swapPivot=getSwapPivot(cells);
    if(swapPivot) return swapPivot;
    if(!isFirst){
      const pick=cells[Math.floor(Math.random()*cells.length)];
      return {col:pick[0],row:pick[1]};
    }
    const mid=cells[Math.floor(cells.length/2)];
    return {col:mid[0],row:mid[1]};
  }

  // 1순위: 무지개볼 (직선5+)
  if(bestLine5){
    const pivot=choosePivot(bestLine5);
    return {type:'rainbow',col:pivot.col,row:pivot.row,color:null,dir:null,mergeCells:bestLine5};
  }

  // 2순위: 폭탄볼 (라인 매치 5+셀, 비직선 — 교차/겹침 라인)
  if(bombGroup){
    const pivot=choosePivot(bombGroup.cells);
    return {type:'bomb',col:pivot.col,row:pivot.row,color:null,dir:null,mergeCells:bombGroup.cells};
  }

  // 3순위: 줄볼 (직선4+)
  // 줄볼 방향 = swap 방향 (기획서 §17 의도): 사용자가 swap한 방향대로 stripe 생성.
  //   세로 swap → 세로 줄볼 / 사선 swap → 그 사선 줄볼.
  // 연쇄 콤보(isFirst=false)는 swap 없이 낙하로 매치 형성되므로 라인 방향에서 추출.
  if(bestLine4){
    const pivot=choosePivot(bestLine4);
    const dir=isFirst?swapDir:getLineDirFromCells(bestLine4);
    return {type:'stripe',col:pivot.col,row:pivot.row,color:null,dir,mergeCells:bestLine4};
  }

  // 4순위: 타겟볼 (직선 없는 클러스터 4+)
  if(targetGroup){
    const pivot=choosePivot(targetGroup.cells);
    return {type:'target',col:pivot.col,row:pivot.row,color:null,dir:null,mergeCells:targetGroup.cells};
  }

  return null;
}

// ── 클러스터 검출 (초기 배치 검증용) ──
// 같은 색 인접 블록 4개 이상이면 true
function hasClusterAt(col,row){
  const color=getColor(col,row);
  if(color===null) return false;
  const visited=new Set();
  const stk=[[col,row]];
  let count=0;
  while(stk.length){
    const [c,r]=stk.pop();
    const k=`${c},${r}`;
    if(visited.has(k)) continue;
    if(getColor(c,r)!==color) continue;
    visited.add(k);
    count++;
    if(count>=4) return true;
    for(const [nc,nr] of getNeighbors(c,r)) stk.push([nc,nr]);
  }
  return false;
}
