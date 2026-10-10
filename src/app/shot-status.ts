export type FiringCardStatus='pending'|'hit'|'miss';
export interface CardStatus {
  id:string;
  state:FiringCardStatus;
  hitAt?:string|null;
}

/** Hit cards stay archived instead of being discarded or counted as active targets. */
export function splitFiringCards<T extends CardStatus>(cards:readonly T[]):{
  active:T[];neutralized:T[];
}{
  return {
    active:cards.filter(card=>card.state!=='hit'),
    neutralized:cards.filter(card=>card.state==='hit').sort((a,b)=>
      (b.hitAt??b.id).localeCompare(a.hitAt??a.id))
  };
}
export function nextActiveFiringCard<T extends CardStatus>(
  cards:readonly T[],currentId:string|null
):string|null{
  if(currentId&&cards.some(c=>c.id===currentId&&c.state!=='hit'))return currentId;
  return cards.find(c=>c.state!=='hit')?.id??null;
}
