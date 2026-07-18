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
                
                // Add tracks to existing peers, onnegotiationneeded will handle the rest
                for (const peer of this.peers.values()) {
                    this.localStream.getTracks().forEach(track => {
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
                // Deterministically decide who is the initiator based on string comparison of IDs
                const isInitiator = this.playerId > player.id;
                this.createPeer(player.id, isInitiator);
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
            peer = this.createPeer(fromId, false);
        }

        try {
            if (signal.sdp) {
                // Glare handling: if we receive an offer while we have a local offer, 
                // the polite peer (lower ID) rolls back and accepts the incoming offer.
                const isPolite = this.playerId < fromId;
                const offerCollision = signal.sdp.type === 'offer' && 
                                       (peer.signalingState !== 'stable' || peer.pendingLocalDescription);

                if (offerCollision) {
                    if (!isPolite) {
                        return; // Ignore the incoming offer
                    }
                    // Polite peer rolls back
                    await Promise.all([
                        peer.setLocalDescription({ type: 'rollback' }),
                        peer.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                    ]);
                } else {
                    await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                }

                // IMPORTANT: ontrack does NOT fire if the transceiver was created locally (e.g. by addTrack).
                // So we MUST manually attach receivers after setting the remote description!
                this.attachTracks(peer, fromId);

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
            if (event.streams && event.streams.length > 0) {
                audioElement.srcObject = event.streams[0];
            } else {
                audioElement.srcObject = new MediaStream([event.track]);
            }
        };

        // Clean up on disconnect
        peer.oniceconnectionstatechange = () => {
            if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'closed') {
                this.removePeer(targetId);
            }
        };

        // Standard dynamic renegotiation
        peer.onnegotiationneeded = async () => {
            try {
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                this.sendSignal(targetId, { sdp: peer.localDescription });
            } catch (err) {
                console.error('Negotiation error:', err);
            }
        };

        // Add local tracks if we already have mic permission
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peer.addTrack(track, this.localStream);
            });
        }

        if (isInitiator) {
            // Create a data channel so ICE gathering and connection starts even without audio tracks
            peer.createDataChannel('init');
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

    attachTracks(peer, targetId) {
        peer.getReceivers().forEach(receiver => {
            if (receiver.track && receiver.track.kind === 'audio') {
                let audioElement = document.getElementById(`audio-${targetId}`);
                if (!audioElement) {
                    audioElement = document.createElement('audio');
                    audioElement.id = `audio-${targetId}`;
                    audioElement.autoplay = true;
                    this.audioContainer.appendChild(audioElement);
                }
                
                // If it's not already playing this exact track
                if (!audioElement.srcObject || !audioElement.srcObject.getTracks().includes(receiver.track)) {
                    audioElement.srcObject = new MediaStream([receiver.track]);
                }
            }
        });
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
