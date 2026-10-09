/**
 * Ephemeral application state in IndexedDB, scoped to one browser-tab session.
 * sessionStorage is used ONLY as a non-data session identifier, never for app data.
 *
 * Browser tab shutdown has no guaranteed asynchronous cleanup callback.
 * A fresh browser session clears old IndexedDB state before restoring anything.
 * Reloading a tab retains the session; a genuinely new tab starts fresh.
 * Session Restore in some browsers may also restore sessionStorage.
 */
const NAME='iron-nest-session-state-v1';
const OBJECT_STORE='session';
const SESSION_TOKEN_KEY='iron-nest-active-session-token';
export type SessionKey='firing'|'plotter'|'waypoint';

export function getOrCreateToken(storage:Pick<Storage,'getItem'|'setItem'>, create:()=>string):
  {token:string;fresh:boolean}{
  const existing=storage.getItem(SESSION_TOKEN_KEY);
  if(existing)return {token:existing,fresh:false};
  const token=create();
  storage.setItem(SESSION_TOKEN_KEY,token);
  return {token,fresh:true};
}
function freshToken():string{
  return typeof crypto!=='undefined'&&crypto.randomUUID?
    crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
}
class SessionDatabase {
  private readonly id:string;
  private readonly firstOpen:boolean;
  private dbPromise:Promise<IDBDatabase>|null=null;
  private queue:Promise<void>=Promise.resolve();
  private memory=new Map<SessionKey,unknown>();
  private unavailable=false;
  constructor(){
    let token=freshToken(),firstOpen=true;
    try{
      const result=getOrCreateToken(sessionStorage,freshToken);
      token=result.token;firstOpen=result.fresh;
    }catch{ /* browsers blocking storage use this page's in-memory token */ }
    this.id=token;
    this.firstOpen=firstOpen;
    if(firstOpen){
      // Older releases wrote permanent localStorage data. Do not leave that
      // information behind when the operator opts into short-lived sessions.
      try{
        for(const legacyKey of [
          'iron-nest-shots-v2','iron-nest-fcc-v1',
          'iron-nest-plot-graph-v1','iron-nest-train-v2','iron-nest-train-v1',
          'iron-nest-map-v2','iron-nest-map-v1'
        ])localStorage.removeItem(legacyKey);
      }catch{ /* blocked storage */ }
    }
  }
  private connect():Promise<IDBDatabase>{
    if(this.dbPromise)return this.dbPromise;
    if(typeof indexedDB==='undefined'){
      this.unavailable=true;
      return Promise.reject(new Error('IndexedDB unavailable'));
    }
    this.dbPromise=new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open(NAME,1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(OBJECT_STORE))db.createObjectStore(OBJECT_STORE);
      };
      request.onerror=()=>reject(request.error??new Error('Cannot open IndexedDB'));
      request.onsuccess=async()=>{
        const db=request.result;
        db.onversionchange=()=>db.close();
        if(this.firstOpen){
          try{
            await new Promise<void>((done,fail)=>{
              const tx=db.transaction(OBJECT_STORE,'readwrite');
              tx.objectStore(OBJECT_STORE).clear();
              tx.oncomplete=()=>done();
              tx.onerror=()=>fail(tx.error);
              tx.onabort=()=>fail(tx.error);
            });
          }catch(e){db.close();reject(e);return;}
        }
        resolve(db);
      };
    }).catch(error=>{
      this.unavailable=true;
      console.warn('Iron Nest session persistence unavailable',error);
      throw error;
    });
    return this.dbPromise;
  }
  async read<T>(key:SessionKey):Promise<T|null>{
    // Await queued modifications so a new tab swap cannot read stale state.
    await this.queue;
    if(this.unavailable)return (this.memory.get(key) as T|undefined)??null;
    try{
      const db=await this.connect();
      return await new Promise<T|null>((resolve,reject)=>{
        const tx=db.transaction(OBJECT_STORE,'readonly');
        const request=tx.objectStore(OBJECT_STORE).get(this.id+':'+key);
        request.onsuccess=()=>resolve((request.result as T|undefined)??null);
        request.onerror=()=>reject(request.error);
      });
    }catch{return (this.memory.get(key) as T|undefined)??null;}
  }
  write<T>(key:SessionKey,data:T):Promise<void>{
    // Structured-clone snapshots immediately; later signal edits can't mutate this write.
    const snapshot=structuredClone(data);
    this.memory.set(key,snapshot);
    this.queue=this.queue.then(async()=>{
      if(this.unavailable)return;
      try{
        const db=await this.connect();
        await new Promise<void>((resolve,reject)=>{
          const tx=db.transaction(OBJECT_STORE,'readwrite');
          tx.objectStore(OBJECT_STORE).put(snapshot,this.id+':'+key);
          tx.oncomplete=()=>resolve();
          tx.onerror=()=>reject(tx.error);
          tx.onabort=()=>reject(tx.error);
        });
      }catch(error){console.warn('Could not auto-save session change',error);}
    });
    return this.queue;
  }
  clear(...keys:SessionKey[]):Promise<void>{
    for(const k of keys)this.memory.delete(k);
    this.queue=this.queue.then(async()=>{
      if(this.unavailable)return;
      try{
        const db=await this.connect();
        await new Promise<void>((resolve,reject)=>{
          const tx=db.transaction(OBJECT_STORE,'readwrite');
          for(const key of keys)tx.objectStore(OBJECT_STORE).delete(this.id+':'+key);
          tx.oncomplete=()=>resolve();
          tx.onerror=()=>reject(tx.error);
        });
      }catch(error){console.warn('Session clear failed',error);}
    });
    return this.queue;
  }
}
export const sessionDb=new SessionDatabase();
