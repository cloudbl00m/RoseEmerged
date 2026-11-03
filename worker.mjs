import { handle } from './core.mjs';
function hostedStore(bucket,key='private/garden-v1.json') {
  return {
    async read(){
      const object=await bucket.get(key);
      return object?{version:object.etag,rows:await object.json()}:{version:null,rows:[]};
    },
    async write(rows,version){
      const condition=version?{etagMatches:version}:{etagDoesNotMatch:'*'};
      return Boolean(await bucket.put(key,JSON.stringify(rows),{onlyIf:condition}));
    }
  };
}
export function hostedApi(request,env) {
  return handle(request,{
    mode:'chatgpt',store:hostedStore(env.BUCKET),teamStore:hostedStore(env.BUCKET,'private/team-v1.json'),
    uploads:{
      async get(id){const object=await env.BUCKET.get('private/uploads/'+id);return object?{bytes:await object.arrayBuffer(),type:object.httpMetadata.contentType}:null;},
      async put(id,bytes,type){await env.BUCKET.put('private/uploads/'+id,bytes,{httpMetadata:{contentType:type}});}
    },
    authorized(req) {
      const id=req.headers.get('oai-authenticated-user-id');
      const email=req.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
      return Boolean(id && email && [env.AKAI_EMAIL,env.HOOR_EMAIL].some(allowed=>allowed && allowed.trim().toLowerCase()===email));
    }
  });
}
