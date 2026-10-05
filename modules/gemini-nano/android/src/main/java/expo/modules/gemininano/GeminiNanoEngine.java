package expo.modules.gemininano;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.genai.common.DownloadCallback;
import com.google.mlkit.genai.common.FeatureStatus;
import com.google.mlkit.genai.common.GenAiException;
import com.google.mlkit.genai.prompt.GenerateContentRequest;
import com.google.mlkit.genai.prompt.GenerateContentResponse;
import com.google.mlkit.genai.prompt.Generation;
import com.google.mlkit.genai.prompt.TextPart;
import com.google.mlkit.genai.prompt.java.GenerativeModelFutures;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Gemini Nano through the ML Kit GenAI Prompt API (Android AICore).
 *
 * Written in Java against the futures API so the Kotlin module never reads ML Kit's Kotlin
 * metadata. Every failure is reported through the callback: on phones without AICore the
 * status is "unavailable" and nothing throws into React Native.
 */
public final class GeminiNanoEngine {

    public interface Callback {
        void success(@Nullable String value);

        void failure(@NonNull String code, @NonNull String message);
    }

    static final String AVAILABLE = "available";
    static final String DOWNLOADABLE = "downloadable";
    static final String DOWNLOADING = "downloading";
    static final String UNAVAILABLE = "unavailable";

    @NonNull
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Nullable
    private GenerativeModelFutures model;

    public void checkStatus(@NonNull Callback callback) {
        try {
            ListenableFuture<Integer> future = model().checkStatus();
            future.addListener(() -> {
                try {
                    callback.success(statusName(future.get()));
                } catch (Throwable t) {
                    callback.success(UNAVAILABLE);
                }
            }, executor);
        } catch (Throwable t) {
            callback.success(UNAVAILABLE);
        }
    }

    /** Resolves with the final status once the model is on the device (immediately if it already is). */
    public void download(@NonNull Callback callback) {
        try {
            GenerativeModelFutures generativeModel = model();
            ListenableFuture<Integer> future = generativeModel.checkStatus();
            future.addListener(() -> {
                try {
                    int status = future.get();
                    if (status != FeatureStatus.DOWNLOADABLE && status != FeatureStatus.DOWNLOADING) {
                        // Already available, or this phone can't run Gemini Nano.
                        callback.success(statusName(status));
                        return;
                    }
                    generativeModel.download(new DownloadCallback() {
                        @Override
                        public void onDownloadStarted(long bytesToDownload) {}

                        @Override
                        public void onDownloadProgress(long totalBytesDownloaded) {}

                        @Override
                        public void onDownloadCompleted() {
                            callback.success(AVAILABLE);
                        }

                        @Override
                        public void onDownloadFailed(@NonNull GenAiException exception) {
                            callback.failure("E_NANO_DOWNLOAD", messageOf(exception));
                        }
                    });
                } catch (Throwable t) {
                    callback.failure("E_NANO_DOWNLOAD", messageOf(unwrap(t)));
                }
            }, executor);
        } catch (Throwable t) {
            callback.failure("E_NANO_DOWNLOAD", messageOf(t));
        }
    }

    public void generate(@NonNull String prompt, float temperature, int topK, int maxOutputTokens, @NonNull Callback callback) {
        try {
            GenerateContentRequest.Builder builder = new GenerateContentRequest.Builder(new TextPart(prompt));
            builder.setTemperature(temperature);
            builder.setTopK(topK);
            builder.setMaxOutputTokens(maxOutputTokens);
            ListenableFuture<GenerateContentResponse> future = model().generateContent(builder.build(), additionalText -> {});
            future.addListener(() -> {
                try {
                    GenerateContentResponse response = future.get();
                    if (response.getCandidates().isEmpty()) {
                        callback.failure("E_NANO_EMPTY", "No candidates returned");
                        return;
                    }
                    callback.success(response.getCandidates().get(0).getText());
                } catch (Throwable t) {
                    callback.failure("E_NANO_GENERATE", messageOf(unwrap(t)));
                }
            }, executor);
        } catch (Throwable t) {
            callback.failure("E_NANO_GENERATE", messageOf(t));
        }
    }

    public void close() {
        try {
            if (model != null) {
                model.getGenerativeModel().close();
            }
        } catch (Throwable ignored) {
            // Closing is best effort.
        }
        model = null;
        executor.shutdown();
    }

    @NonNull
    private GenerativeModelFutures model() {
        if (model == null) {
            model = GenerativeModelFutures.from(Generation.INSTANCE.getClient());
        }
        return model;
    }

    @NonNull
    private static String statusName(int status) {
        if (status == FeatureStatus.AVAILABLE) return AVAILABLE;
        if (status == FeatureStatus.DOWNLOADABLE) return DOWNLOADABLE;
        if (status == FeatureStatus.DOWNLOADING) return DOWNLOADING;
        return UNAVAILABLE;
    }

    @NonNull
    private static Throwable unwrap(@NonNull Throwable t) {
        return t instanceof ExecutionException && t.getCause() != null ? t.getCause() : t;
    }

    @NonNull
    private static String messageOf(@NonNull Throwable t) {
        String message = t.getMessage();
        return message != null ? message : t.getClass().getSimpleName();
    }
}
