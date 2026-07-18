// WebRTC Voice Chat Manager
export class VoiceChat {
    constructor() {
        this.peers = new Map(); // targetId -> RTCPeerConnection
        this.localStream = null;
        this.socket = null;
        this.playerId = null;
        this.isMicEnabled = false;
        
        // Audio elements container
        this.audioContainer = document.createElement('div');
        this.audioContainer.id = 'webrtc-audio-container';
        this.audioContainer.style.display = 'none';
        document.body.appendChild(this.audioContainer);
    }

    init(socket, playerId) {
        this.socket = socket;
        this.playerId = playerId;
    }

    async toggleMic() {
        if (!this.localStream) {
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.isMicEnabled = true;
                
                // Add tracks to existing peers without renegotiation
                for (const peer of this.peers.values()) {
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    if (audioTrack) {
                        const transceiver = peer.getTransceivers().find(t => t.receiver.track.kind === 'audio' || (t.sender && t.sender.track && t.sender.track.kind === 'audio') || true);
                        // In WebRTC, if we added a transceiver earlier, we can just replace the track
                        const audioTransceivers = peer.getTransceivers();
                        if (audioTransceivers.length > 0 && audioTransceivers[0].sender) {
                            audioTransceivers[0].sender.replaceTrack(audioTrack);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to get microphone:', err);
                alert('Không thể truy cập Microphone. Vui lòng cấp quyền!');
                return false;
            }
        } else {
            this.isMicEnabled = !this.isMicEnabled;
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = this.isMicEnabled;
            });
        }
        return this.isMicEnabled;
    }

    // Called when joining a room (connect to all existing players)
    join(players) {
        players.forEach(player => {
            if (player.id !== this.playerId && !this.peers.has(player.id)) {
                this.createPeer(player.id, true);
            }
        });
    }

    // Called when a new player joins the room
    handlePlayerJoined(player) {
        // We let the new player initiate the connection via their join() call
        // So we just wait for their offer.
    }

    // Called when receiving a signaling message
    async handleSignal(fromId, signal) {
        let peer = this.peers.get(fromId);
        
        if (!peer) {
            // We received an offer from a new player
            peer = this.createPeer(fromId, false);
        }

        try {
            if (signal.sdp) {
                await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                if (signal.sdp.type === 'offer') {
                    // Force audio transceivers to sendrecv so we can replaceTrack later without renegotiation
                    peer.getTransceivers().forEach(t => {
                        if (t.receiver.track.kind === 'audio') {
                            t.direction = 'sendrecv';
                        }
                    });
                    
                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    this.sendSignal(fromId, { sdp: peer.localDescription });
                }
            } else if (signal.candidate) {
                await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
        } catch (err) {
            console.error('WebRTC signal error:', err);
        }
    }

    createPeer(targetId, isInitiator) {
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        this.peers.set(targetId, peer);

        // Send ICE candidates to the target
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal(targetId, { candidate: event.candidate });
            }
        };

        // Receive audio tracks
        peer.ontrack = (event) => {
            let audioElement = document.getElementById(`audio-${targetId}`);
            if (!audioElement) {
                audioElement = document.createElement('audio');
                audioElement.id = `audio-${targetId}`;
                audioElement.autoplay = true;
                this.audioContainer.appendChild(audioElement);
            }
            if (event.streams && event.streams.length > 0) {
                audioElement.srcObject = event.streams[0];
            } else {
                // When using addTransceiver without streams, we must construct the MediaStream manually
                audioElement.srcObject = new MediaStream([event.track]);
            }
        };

        // Clean up on disconnect
        peer.oniceconnectionstatechange = () => {
            if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'closed') {
                this.removePeer(targetId);
            }
        };

        // Add local tracks if we already have mic permission
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peer.addTrack(track, this.localStream);
            });
        } else {
            // Pre-create an audio transceiver so we can replaceTrack later without renegotiation!
            peer.addTransceiver('audio', { direction: 'sendrecv' });
        }

        if (isInitiator) {
            peer.createOffer()
                .then(offer => peer.setLocalDescription(offer))
                .then(() => {
                    this.sendSignal(targetId, { sdp: peer.localDescription });
                })
                .catch(err => console.error('Failed to create offer:', err));
        }

        return peer;
    }

    removePeer(targetId) {
        const peer = this.peers.get(targetId);
        if (peer) {
            peer.close();
            this.peers.delete(targetId);
        }
        const audioElement = document.getElementById(`audio-${targetId}`);
        if (audioElement) {
            audioElement.remove();
        }
    }

    sendSignal(targetId, signal) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'webrtc-signal',
                targetId: targetId,
                signal: signal
            }));
        }
    }

    disconnect() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        for (const [targetId, peer] of this.peers.entries()) {
            peer.close();
        }
        this.peers.clear();
        this.audioContainer.innerHTML = '';
        this.isMicEnabled = false;
    }
}
