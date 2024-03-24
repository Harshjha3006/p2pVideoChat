
let localStream; // media stream of local user
let remoteStream; //  media stream of remote user

let peerConnection;


const APP_ID = "0cdd7756eb144f4b8a519765eadc3c46"
const token = null

let uid = String(Math.floor(Math.random() * 10000))
const urlParams = new URLSearchParams(window.location.search)
const roomId = urlParams.get("room")


if(!roomId){
    window.location = 'lobby.html'
}

let client;  // client for agora sdk 
let channel;

// STUN servers 
const servers = {
    iceServers : [
        {
            urls : ['stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']
        }
    ]
}

let constraints = {
    video : {
        width : {min : 640,ideal : 1920, max : 1920},
        height : {min : 480,ideal : 1080,max : 1080}
    },
    audio : true
}

const init = async ()=>{
    
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({token,uid})

    channel = client.createChannel(roomId)
    await channel.join()

    channel.on("MemberJoined",handleUserJoined)
    client.on("MessageFromPeer",handlePeerMessage)
    channel.on("MemberLeft",handleUserLeft)

    // getting camera permissions
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('user-1').srcObject = localStream;

}

const handleUserLeft = async (MemberId) => {
    document.getElementById("user-2").style.display = 'none'
    document.getElementById('user-1').classList.remove("smallFrame");
}

const handleUserJoined = async (MemberId) =>{
    console.log("A new user joined , ",MemberId)
    createOffer(MemberId)
}

const handlePeerMessage = async (message,MemberId) => {
    message = JSON.parse(message.text)   
    if(message.type === "offer"){
        createAnswer(MemberId,message.offer)
    }

    else if(message.type === "answer"){
        if(!peerConnection.currentRemoteDescription){
            await peerConnection.setRemoteDescription(message.answer)
        }
    }

    else if(message.type === "candidate"){
        if(peerConnection){
            await peerConnection.addIceCandidate(message.candidate)
        }
    }
}

const createPeerConnection = async (MemberId) =>{
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';
    document.getElementById('user-1').classList.add("smallFrame");

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia(constraints)
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks().forEach((track)=>{
        peerConnection.addTrack(track,localStream)
    })

    peerConnection.ontrack = (event) =>{
        event.streams[0].getTracks().forEach((track)=>{
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) =>{
        if(event.candidate){
            await client.sendMessageToPeer({text : JSON.stringify({'type' : 'candidate','candidate' : event.candidate})},MemberId)
        }
    }
}

const createOffer = async (MemberId)=>{
    
    await createPeerConnection(MemberId)
    // setting up local offer
    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    await client.sendMessageToPeer({text : JSON.stringify({'type' : 'offer','offer' : offer})},MemberId)
}


const createAnswer = async (MemberId,offer) => {
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)

    let answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    await client.sendMessageToPeer({text : JSON.stringify({'type' : 'answer','answer' : answer})},MemberId)

}


const leaveChannel = async () =>{
    await channel.leave()
    await client.logout()
}

const toggleCamera = () =>{
    let videoTrack = localStream.getTracks().find(track => track.kind === "video")

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('cameraBtn').style.backgroundColor = "rgb(255, 80, 80)"
    }
    else{
        videoTrack.enabled = true
        document.getElementById('cameraBtn').style.backgroundColor = "rgb(179, 102, 249, .9)"
    }
}

const toggleMic = () =>{
    let audioTrack = localStream.getTracks().find(track => track.kind === "audio")

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('micBtn').style.backgroundColor = "rgb(255, 80, 80)"
    }
    else{
        audioTrack.enabled = true
        document.getElementById('micBtn').style.backgroundColor = "rgb(179, 102, 249, .9)"
    }
}

window.addEventListener("beforeunload",leaveChannel)

document.getElementById('cameraBtn').addEventListener("click",toggleCamera)
document.getElementById("micBtn").addEventListener("click",toggleMic)

init()