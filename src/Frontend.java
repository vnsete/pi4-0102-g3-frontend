package br.servihub;
import com.sun.net.httpserver.*;
import java.io.*;
import java.nio.file.*;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.Executors;

/** Static assets and same-origin reverse proxy. Internal endpoints are never proxied. */
public final class Frontend {
    private static String env(String k,String f){return System.getenv().getOrDefault(k,f);}
    public static void main(String[]args)throws Exception {
        HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        Path root=Path.of(env("PUBLIC_DIR","pi4-0102-g3-frontend/public")).toAbsolutePath().normalize();
        HttpServer s=HttpServer.create(new InetSocketAddress(env("BIND_HOST","127.0.0.1"),Integer.parseInt(env("PORT","8080"))),64);
        s.createContext("/",x->{try{
            String path=x.getRequestURI().getPath();
            x.getResponseHeaders().set("X-Content-Type-Options","nosniff");
            x.getResponseHeaders().set("Referrer-Policy","same-origin");
            x.getResponseHeaders().set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
            if(path.startsWith("/api/")){
                boolean finance=path.startsWith("/api/financeiro/");String route=path.substring(finance?15:4);
                if(route.startsWith("/interno")||!route.startsWith("/")){reply(x,404,"application/json","{\"codigo\":\"ROTA_NAO_ENCONTRADA\",\"mensagem\":\"Operação não encontrada.\"}".getBytes());return;}
                byte[] b=x.getRequestBody().readNBytes(65537);if(b.length>65536){reply(x,413,"application/json","{\"codigo\":\"CORPO_MUITO_GRANDE\",\"mensagem\":\"O limite é 64 KiB.\"}".getBytes());return;}
                String target=env(finance?"BACKEND2_URL":"BACKEND1_URL",finance?"http://127.0.0.1:8082":"http://127.0.0.1:8081");
                HttpRequest.Builder r=HttpRequest.newBuilder(URI.create(target+route+(x.getRequestURI().getRawQuery()==null?"":"?"+x.getRequestURI().getRawQuery()))).timeout(Duration.ofSeconds(15));
                for(String h:List.of("Content-Type","Cookie","Origin")){String v=x.getRequestHeaders().getFirst(h);if(v!=null)r.header(h,v);}
                try{
                    HttpResponse<byte[]> res=client.send(r.method(x.getRequestMethod(),b.length==0?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofByteArray(b)).build(),HttpResponse.BodyHandlers.ofByteArray());
                    res.headers().firstValue("Set-Cookie").ifPresent(v->x.getResponseHeaders().set("Set-Cookie",v));reply(x,res.statusCode(),res.headers().firstValue("Content-Type").orElse("application/json"),res.body());
                }catch(Exception e){reply(x,503,"application/json","{\"codigo\":\"MODULO_INDISPONIVEL\",\"mensagem\":\"O módulo está indisponível. Consulte novamente antes de repetir uma gravação.\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8));}
                return;
            }
            if(!x.getRequestMethod().equals("GET")&&!x.getRequestMethod().equals("HEAD")){reply(x,405,"text/plain","Método não permitido".getBytes());return;}
            Path file=root.resolve(path.equals("/")?"index.html":path.substring(1)).normalize();
            if(!file.startsWith(root)||!Files.isRegularFile(file)){reply(x,404,"text/plain","Arquivo não encontrado".getBytes());return;}
            String type=path.endsWith(".ttf")?"font/ttf":path.endsWith(".js")?"text/javascript; charset=utf-8":path.endsWith(".css")?"text/css; charset=utf-8":"text/html; charset=utf-8";
            reply(x,200,type,Files.readAllBytes(file));
        }catch(Exception e){if(x.getResponseCode()==-1)reply(x,500,"text/plain","Falha ao atender".getBytes());}finally{x.close();}});
        s.setExecutor(Executors.newFixedThreadPool(16));s.start();System.out.println("Abra "+env("PUBLIC_ORIGIN","http://localhost:8080"));
    }
    private static void reply(HttpExchange x,int status,String type,byte[] b)throws IOException {x.getResponseHeaders().set("Content-Type",type);x.getResponseHeaders().set("Cache-Control","no-store");x.sendResponseHeaders(status,b.length);x.getResponseBody().write(b);}
}
