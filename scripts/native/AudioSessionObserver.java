package com.doublesymmetry.kotlinaudio.players;

import android.content.Context;
import android.content.Intent;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.Player;

/**
 * RNTP 4.1.2 / KotlinAudio 2.1.0 adapter. KotlinAudio's final queue player does
 * not expose its audio session. A Java class in its package can use the JVM
 * protected getter without reflection or replacing the playback engine.
 * Keep this adapter compiled against the locked KotlinAudio version.
 */
public final class AudioSessionObserver implements Player.Listener {
    private final Context context;
    private final ExoPlayer player;
    private int sessionId;

    public AudioSessionObserver(Context context, BaseAudioPlayer audioPlayer) {
        this.context = context.getApplicationContext();
        this.player = audioPlayer.getExoPlayer();
        player.addListener(this);
        onAudioSessionIdChanged(player.getAudioSessionId());
    }

    @Override
    public void onAudioSessionIdChanged(int audioSessionId) {
        sessionId = audioSessionId;
        publish(false);
    }

    public void release() {
        player.removeListener(this);
        publish(true);
    }

    private void publish(boolean closing) {
        context.sendBroadcast(new Intent(context.getPackageName() + ".audio-effects.SESSION")
            .setPackage(context.getPackageName())
            .putExtra("sessionId", sessionId)
            .putExtra("closing", closing));
    }
}
