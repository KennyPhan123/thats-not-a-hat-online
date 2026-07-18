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
                
                // Add tracks to existing peers
                for (const peer of this.peers.values()) {
                    this.localStream.getTracks().forEach(track => {
                        // Only add if not already added
                        const senders = peer.getSenders();
                        const alreadyAdded = senders.find(s => s.track === track);
                        if (!alreadyAdded) {
                            peer.addTrack(track, this.localStream);
                        }
                    });
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
            audioElement.srcObject = event.streams[0];
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
        }

        if (isInitiator) {
            // Note: need to ensure there is at least one track or transceiver to trigger ICE candidate generation in some browsers?
            // Actually, if we don't have a track yet (mic not enabled), we should add a transceiver for audio to receive!
            peer.addTransceiver('audio', { direction: 'recvonly' });
            
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
