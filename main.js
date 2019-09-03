const devConfig = require('./config.json');
const config = {
  apiKey: devConfig.apiKey,
  devId: devConfig.devId,
  authProviders: ['blockstack'], 
  storageProviders: ['blockstack', 'pinata'], 
  appOrigin: window.location.origin, 
  scopes: ['publish_data', 'store_write', 'email'] 
}
let startPage = "signup";
let loggedIn = false;
let loading = false;
let notesCollection = [];
let noteContent = "";
let singleNoteId = null;
let noteDate = "";

pageLoad();
if(localStorage.getItem('user-session')) {
  fetchCollection();
}

let editable = document.getElementById('note');
editable.addEventListener('input', function() {
  noteContent = editable.innerHTML;
  console.log(noteContent);
});

function pageLoad() {
  //check localStorage
  if(localStorage.getItem('user-session')) {
    loggedIn = true;
  }
  if(loading) {
    document.getElementById('loading').style.display = "block";
    document.getElementById('root-app').style.display = "none";
    document.getElementById('signup-form').style.display = "none";
    document.getElementById('signin-form').style.display = "none";
  } else if(loggedIn) {
    document.getElementById('loading').style.display = "none";
    document.getElementById('signup-form').style.display = "none";
    document.getElementById('signin-form').style.display = "none";
    document.getElementById('root-app').style.display = "block";
  } else {
    //Here we are deciding whether to show the sign up or sign in form
    if(startPage === "signup") {
      document.getElementById('signin-form').style.display = "none";
      document.getElementById('signup-form').style.display = "block";
    } else if(startPage === "signin") {
      document.getElementById('signin-form').style.display = "block";
      document.getElementById('signup-form').style.display = "none";
    } else {
      document.getElementById('root-app').style.display = "block";
      document.getElementById('signup-form').style.display = "none";
      document.getElementById('signin-form').style.display = "none";
    }
  }
}

function changeForm(page) {
  if(page === "signin") {
    document.getElementById('signin-form').style.display = "block";
    document.getElementById('signup-form').style.display = "none";
  } else {
    document.getElementById('signin-form').style.display = "none";
    document.getElementById('signup-form').style.display = "block";
  }
}

async function signUp(e) {
  e.preventDefault();
  //Keychain request
  loading = true;
  const username = document.getElementById('username-signup').value;
  const password = document.getElementById('password-signup').value;
  const email = document.getElementById('email-signup').value;
  pageLoad();
  const data = `username=${username}&password=${password}&email=${email}&development=false&devId=${config.devId}`;        
  const urlKeychain = "https://api.simpleid.xyz/keychain";
  const urlAppKeys = "https://api.simpleid.xyz/appkeys";

  const keychain = await postToApi(data, urlKeychain);
  console.log(keychain);
  if(!keychain.includes("KEYCHAIN_ERROR")) {
    //Now we need to fetch the user data from a second API call
    let profile = {
      '@type': 'Person',
      '@context': 'http://schema.org',
      'apps': {}
    }
    profile.apps["https://thisisnew.com"] = "";
    // const url = encodeURIComponent(window.location.orign);
    const uriEncodedProfile = encodeURIComponent(JSON.stringify(profile))
    
    const keyData = `username=${username}&password=${password}&profile=${uriEncodedProfile}&url=https%3A%2F%2Fthisisnew.com&development=false&devId=${config.devId}`
    const userData = await postToApi(keyData, urlAppKeys);
    if(!userData.includes('ERROR')) {
      console.log(userData);
      let userSession = JSON.parse(userData);
      userSession.username = username;
      localStorage.setItem('user-session', JSON.stringify(userSession));
      loading = false;
      loggedIn = true;
      pageLoad();
      fetchCollection();
    } else {
      loading = false;
      loggedIn = false;
      pageLoad();
      console.log("Error");
    }
  } else {
    loading = false;
    loggedIn = false;
    pageLoad();
    console.log("Failed")
  }
}

async function signIn(e) {
  e.preventDefault();
  loading = true;
  const username = document.getElementById('username-signin').value;
  const password = document.getElementById('password-signin').value;
  pageLoad();
  const urlAppKeys = "https://api.simpleid.xyz/appkeys";
  let profile = {
    '@type': 'Person',
    '@context': 'http://schema.org',
    'apps': {}
  }
  profile.apps["https://thisisnew.com"] = "";
  //const url = encodeURIComponent(window.location.origin);
  const uriEncodedProfile = encodeURIComponent(JSON.stringify(profile))
  
  const keyData = `username=${username}&password=${password}&profile=${uriEncodedProfile}&url=https%3A%2F%2Fthisisnew.com&development=false&devId=${config.devId}`
  const userData = await postToApi(keyData, urlAppKeys);
  if(!userData.includes('ERROR')) {
    console.log(userData);
    let userSession = JSON.parse(userData);
    userSession.username = username;
    localStorage.setItem('user-session', JSON.stringify(userSession));
    loading = false;
    loggedIn = true;
    pageLoad();
    fetchCollection();
  } else {
    loading = false;
    loggedIn = false;
    pageLoad();
    console.log("Error");
  }
}

function signOut() {
  localStorage.removeItem('user-session');
  window.location.reload();
}

function postToApi(data, url) {
  return new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.addEventListener("readystatechange", function () {
      if (this.readyState === 4) {
        // return this.responseText;
        resolve(this.responseText);
      }
    });

    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.setRequestHeader("Authorization", config.apiKey);
    xhr.withCredentials = false;

    xhr.send(data);
  })
}

async function fetchCollection() {
  document.getElementById('no-content').innerText = ""
  loading = true;
  pageLoad();
  const privKey = JSON.parse(localStorage.getItem('user-session')).blockstack.private;
  const url = "https://api.simpleid.xyz/fetchContent";
  const username = JSON.parse(localStorage.getItem('user-session')).username;
  const notesId = "notesIndex";
  console.log(notesId);
  const data = `username=${username}&devId=${config.devId}&devSuppliedIdentifier=${notesId}&development=false`;
  const pinnedContent = await postToApi(data, url);
  console.log(pinnedContent);
  if(!pinnedContent.includes("ERROR")) {
    const decryptedContent = decryptContent(pinnedContent, privKey);
    notesCollection = JSON.parse(decryptedContent);
    console.log(notesCollection);
    if(notesCollection.length > 0) {
      renderCollection();
    } else {
      document.getElementById('no-content').innerText = "You don't have any notes yet, go create some!"
    }
  } else {
    notesCollection = [];
    document.getElementById('no-content').innerText = "You don't have any notes yet, go create some!"
    loading = false;
    pageLoad();
  }
}

function newNote() {
  singleNoteId = null;
  noteDate = null;
  document.getElementById('notes-collection').style.display = "none";
  document.getElementById('single-note').style.display = "block";
  document.getElementById('note-title').value = "";
  document.getElementById('note').innerHTML = "";
}

function closeNote() {
  document.getElementById('notes-collection').style.display = "block";
  document.getElementById('single-note').style.display = "none";
}

function renderCollection() {
  loading = false;
  pageLoad();
  let list = document.getElementById('notes-collection-items');
  list.innerHTML = "";
  for(const note of notesCollection) {
    let item = document.createElement('div');
    let h3 = document.createElement('h3');
    let p = document.createElement('p');
    item.appendChild(h3);
    item.appendChild(p);
    h3.appendChild(document.createTextNode(note.title));
    p.appendChild(document.createTextNode(note.date || ""));
    item.setAttribute("id", note.id);
    item.setAttribute("class", "card card-1");
    item.onclick = () => loadNote(note.id);
    item.style.cursor = "pointer";
    list.appendChild(item);
  }
}

async function loadNote(id) {
  loading = true;
  pageLoad();
  singleNoteId = id;
  const privKey = JSON.parse(localStorage.getItem('user-session')).blockstack.private;
  const url = "https://api.simpleid.xyz/fetchContent";
  const username = JSON.parse(localStorage.getItem('user-session')).username;
  const noteId = JSON.stringify(id);
  const data = `username=${username}&devId=${config.devId}&devSuppliedIdentifier=${noteId}&development=false`;

  document.getElementById('notes-collection').style.display = "none";
  document.getElementById('single-note').style.display = "block";

  const pinnedContent = await postToApi(data, url);
  console.log(pinnedContent);
  if(!pinnedContent.includes("ERROR")) {
    const decryptedContent = decryptContent(pinnedContent, privKey);
    noteContent = JSON.parse(decryptedContent).content;
    noteDate = JSON.parse(decryptedContent).date;
    document.getElementById('note-title').value = JSON.parse(decryptedContent).title;
    document.getElementById('note').innerHTML = noteContent;
    loading = false;
    pageLoad();
  } else {
    console.log("Couldn't load note");
    loading = false;
    pageLoad();
  }
}

async function saveNote() {
  document.getElementById('no-content').innerText = ""
  let date = new Date();

  let note = {
    id: singleNoteId ? singleNoteId : Date.now(),
    date: noteDate ? noteDate : date.toISOString().substring(0, 10),
    title: document.getElementById('note-title').value === "" ? "Untitled" : document.getElementById('note-title').value
  }
  let index = await notesCollection.map((x) => {return x.id }).indexOf(note.id);
  if(index < 0) {
    //This is a new note
    notesCollection.push(note);
    // notesCollection = [];
  } else if(index > -1) {
    //The note exists and needs to be updated
    notesCollection[index] = note;
    // notesCollection = [];
  } else {
    console.log("Error with note index")
  }
  loading = true;
  pageLoad();
  console.log(notesCollection);
  const privKey = JSON.parse(localStorage.getItem('user-session')).blockstack.private;
  const encryptedContent = encryptContent(JSON.stringify(notesCollection), privKey);
  console.log(encryptedContent);
  const pinURL = "https://api.simpleid.xyz/pinContent";
  const username = JSON.parse(localStorage.getItem('user-session')).username;
  const identifier = "notesIndex";
  const content = encodeURIComponent(JSON.stringify(encryptedContent));
  const data = `username=${username}&devId=${config.devId}&devSuppliedIdentifier=${identifier}&contentToPin=${content}&development=false`;
  const postedContent = await postToApi(data, pinURL);
  if(!postedContent.includes("ERROR")) {
    console.log(postedContent);
    note.content = noteContent;
    const encryptedNote = encryptContent(JSON.stringify(note), privKey);
    const noteIdentifier = JSON.stringify(note.id);
    const saveNoteContent = encodeURIComponent(JSON.stringify(encryptedNote));
    const noteData = `username=${username}&devId=${config.devId}&devSuppliedIdentifier=${noteIdentifier}&contentToPin=${saveNoteContent}&development=false`;
    const postedNote = await postToApi(noteData, pinURL);
    console.log(postedNote);
    if(!postedNote.includes("ERROR")) {
      document.getElementById('notes-collection').style.display = "block";
      document.getElementById('single-note').style.display = "none";
      loading = false;
      pageLoad();
      renderCollection();
    } else {
      console.log("Error posting note content");
      console.log(postedNote);
      loading = false;
      pageLoad();
    }
  } else {
    console.log("Error pinning content");
    console.log(postedContent);
    loading = false;
    pageLoad();
  }
}

function encryptContent(content,passcode) {
  var result = []; var passLen = passcode.length ;
  for(var i = 0  ; i < content.length ; i++) {
      var passOffset = i%passLen ;
      var calAscii = (content.charCodeAt(i)+passcode.charCodeAt(passOffset));
      result.push(calAscii);
  }
  return JSON.stringify(result) ;
}

function decryptContent(content,passcode) {
  var result = [];var str = '';
  var codesArr = JSON.parse(content);var passLen = passcode.length ;
  for(var i = 0  ; i < codesArr.length ; i++) {
      var passOffset = i%passLen ;
      var calAscii = (codesArr[i]-passcode.charCodeAt(passOffset));
      result.push(calAscii) ;
  }
  for(var i = 0 ; i < result.length ; i++) {
      var ch = String.fromCharCode(result[i]); str += ch ;
  }
  return str ;
}