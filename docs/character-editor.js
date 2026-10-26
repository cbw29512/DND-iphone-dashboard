/* Two modes of the SAME #play card. Editing never creates a second card. */
(function(root){
"use strict";
const $=id=>document.getElementById(id);
let active=null,previous=null,creating=false,form=null,saveCard=null,getCurrent=null,showDraft=null,restore=null,showFight=null;
function message(value){$("cardEditMessage").textContent=value;}
function open(card,isNew=false){
 if(!card)return;
 previous=getCurrent?.()||null;
 creating=isNew;active=card;
 if(isNew)showDraft(card);
 else showFight();
 $("importPanel").open=false;
 $("play").classList.add("editing");
 form=CharacterFormFields.build(card);
 $("editCharacterBtn").hidden=true;
 $("saveCharacterBtn").hidden=false;
 $("cancelCharacterBtn").hidden=false;
 $("saveCharacterBottom").hidden=false;
 message(isNew?"Fill in this character card, then Save & Play.":"Edit these fields right on your character card.");
 $("portraitUpload").value="";
 $("portraitImage").dataset.editSrc="";
 $("play").scrollIntoView({block:"start",behavior:"instant"});
}
function close(){
 $("play").classList.remove("editing");
 $("saveCharacterBtn").hidden=true;
 $("cancelCharacterBtn").hidden=true;
 $("saveCharacterBottom").hidden=true;
 $("editCharacterBtn").hidden=false;
 $("portraitImage").dataset.editSrc="";
 active=null;form=null;creating=false;
}
function cancel(){
 const original=previous;
 close();
 restore(original);
 previous=null;
}
function save(){
 if(!active||!form)return;
 try{
  const values=form.collect();
  values.fresh=creating;
  values.portrait=$("portraitImage").dataset.editSrc||active.portrait||"";
  const updated=CharacterFormModel.apply(active,values);
  if(updated.weapons.some(w=>w.formula&&!/^\d+d\d+(?:[+-]\d+)?$/i.test(w.formula)))
   throw Error("Damage dice should look like 1d8+3.");
  for(const spell of updated.spells){
   if(spell.custom?.dice&&!/^([1-9]|[12]\d|30)d(4|6|8|10|12|20)$/i.test(spell.custom.dice))
    throw Error("Spell dice should look like 8d6.");
  }
  close();previous=null;saveCard(updated);
 }catch(error){message(error.message);}
}
function portrait(file){
 if(!file)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>7000000){
  message("Choose PNG, JPEG or WebP under 7 MB.");return;
 }
 const photo=new Image(),url=URL.createObjectURL(file);
 photo.onload=()=>{
  try{
   const canvas=document.createElement("canvas");
   const scale=Math.min(1,350/photo.naturalWidth,420/photo.naturalHeight);
   canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));
   canvas.getContext("2d").drawImage(photo,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL("image/jpeg",.74);
   if(!CharacterFormModel.safePortrait(data))throw Error("The picture could not fit in the saved card.");
   $("portraitImage").src=data;$("portraitImage").hidden=false;
   $("portraitInitials").hidden=true;$("portraitImage").dataset.editSrc=data;
   message("Picture selected. Save & Play to keep it.");
  }catch(error){message(error.message);}
  finally{URL.revokeObjectURL(url);}
 };
 photo.onerror=()=>{URL.revokeObjectURL(url);message("Picture could not be read.");};
 photo.src=url;
}
function initialize(onSave,current,displayDraft,restoreCard,renderFight){
 saveCard=onSave;getCurrent=current;showDraft=displayDraft;restore=restoreCard;showFight=renderFight;
 $("createBtn").addEventListener("click",()=>open(CharacterFormModel.blank(),true));
 $("editCharacterBtn").addEventListener("click",()=>open(getCurrent?.(),false));
 $("saveCharacterBtn").addEventListener("click",save);
 $("saveCharacterBottom").addEventListener("click",save);
 $("cancelCharacterBtn").addEventListener("click",cancel);
 $("portraitUpload").addEventListener("change",e=>portrait(e.target.files?.[0]));
}
root.CharacterEditor=Object.freeze({initialize,open,cancel});
})(typeof globalThis!=="undefined"?globalThis:this);
