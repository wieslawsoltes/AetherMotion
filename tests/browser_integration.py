"""End-to-end editor, native WebGPU pixels, offline encoding and portable build checks.
Requires a running `npm start`, Playwright, Pillow, Chromium, ffmpeg and ffprobe.
Browser data is isolated in temporary contexts. No accounts or external sites are used.
"""
from playwright.sync_api import sync_playwright
from PIL import Image
import json, base64, pathlib, subprocess, os, shutil, platform, datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(os.environ.get('AETHER_TEST_OUTPUT', ROOT/'test-results'))
OUT.mkdir(parents=True, exist_ok=True)
BASE_URL=os.environ.get('AETHER_BASE_URL','http://127.0.0.1:4173').rstrip('/')
SOFTWARE_GPU=os.environ.get('AETHER_SOFTWARE_GPU','0')=='1'
HEADLESS=os.environ.get('AETHER_HEADLESS','0')=='1'
CHROMIUM=os.environ.get('AETHER_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome')
Image.new('RGB',(80,50),(238,130,93)).save(OUT/'test-import.png')
results=[]
def ok(name,condition=True):
 assert condition,name
 results.append(name);print('PASS',name,flush=True)
with sync_playwright() as p:
 args=['--enable-unsafe-webgpu']
 if SOFTWARE_GPU:
  args+=['--use-angle=swiftshader','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface']
 launch={'headless':HEADLESS,'args':args}
 if CHROMIUM: launch['executable_path']=CHROMIUM
 browser=p.chromium.launch(**launch)
 browser_version=browser.version
 page=browser.new_page(viewport={'width':1600,'height':1000},accept_downloads=True)
 errors=[];gpu_errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:gpu_errors.append(m.text) if m.type=='error' else None)
 page.goto(BASE_URL,wait_until='networkidle')
 page.wait_for_function('!!window.aether')
 page.wait_for_timeout(1000)
 ok('WebGPU initialization and WGSL validation',page.evaluate('aether.getRenderer().kind')=='WebGPU')
 original=page.evaluate('aether.getDocument()')
 title=original['layers'][2]['id']
 ok('Demo composition has eleven real layers',len(original['layers'])==11)
 # Character editor and transaction undo.
 page.locator('#inspector-content textarea').fill('REAL EDITING\nIN YOUR BROWSER.')
 page.locator('#inspector-content textarea').press('Tab')
 ok('Text editing updates the document',page.evaluate('aether.getDocument().layers.find(l=>l.id===aether.getState().selected).data.text').startswith('REAL EDITING'))
 page.evaluate("aether.dispatch('undo')")
 ok('Undo restores editable text',page.evaluate('aether.getDocument().layers[2].data.text')=='BEYOND\nTHE FRAME.')
 # Animated numeric property: creates a real current-frame key.
 field=page.locator('#inspector-content input[data-prop="y"]')
 field.fill('580');field.press('Tab')
 ok('Animated inspector value inserts a keyframe',page.evaluate('aether.getDocument().layers[2].tracks.y.some(k=>k.t===2.4&&k.v===580)'))
 page.evaluate("aether.dispatch('undo')")
 # Draw rectangle, then drag on the composition canvas.
 page.locator('[data-tool="rect"]').click()
 box=page.locator('#stage-box').bounding_box()
 x=box['x']+box['width']*.16;y=box['y']+box['height']*.76
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+96,y+40,steps=6);page.mouse.up()
 rect=page.evaluate('aether.getDocument().layers[0]')
 ok('Pointer drawing creates sized vector layer',rect['type']=='rect' and rect['width']>200)
 centerx=x+48;centery=y+20
 page.mouse.move(centerx,centery);page.mouse.down();page.mouse.move(centerx+24,centery-16,steps=5);page.mouse.up()
 moved=page.evaluate('aether.getDocument().layers[0]')
 ok('Canvas manipulation changes model coordinates',abs(moved['x']-rect['x'])>20)
 # Keyframe activation, editing, timeline dragging.
 page.evaluate('aether.setTime(1)')
 page.locator('#inspector-content [data-keyprop="opacity"]').click()
 page.evaluate('aether.setTime(3)')
 field=page.locator('#inspector-content input[data-prop="opacity"]');field.fill('20');field.press('Tab')
 ok('Two-keyframe opacity animation',page.evaluate('aether.getDocument().layers[0].tracks.opacity.length')==2)
 page.keyboard.press('t')
 keys=page.locator('.key[data-prop="opacity"]');kb=keys.nth(1).bounding_box()
 page.mouse.move(kb['x']+3,kb['y']+3);page.mouse.down();page.mouse.move(kb['x']+42,kb['y']+3,steps=4);page.mouse.up()
 ok('Timeline keyframe drag changes key time',page.evaluate('aether.getDocument().layers[0].tracks.opacity[1].t')>3)
 page.locator('#graph-button').click();ok('Value graph editor is functional',page.locator('#graph-wrap').is_visible())
 page.locator('#graph-easing').select_option('linear')
 ok('Easing selector changes selected keyframe',page.evaluate('aether.getDocument().layers[0].tracks.opacity.some(k=>k.ease==="linear")'))
 page.locator('#graph-button').click()
 # Visibility and solo switches.
 selected_id=page.evaluate('aether.getState().selected')
 page.locator(f'[data-layer-toggle="enabled"][data-id="{selected_id}"]').click()
 ok('Visibility switch removes layer from evaluated scene',not page.evaluate('(id)=>aether.evaluate(aether.getTime()).some(l=>l.id===id)',selected_id))
 page.locator(f'[data-layer-toggle="enabled"][data-id="{selected_id}"]').click()
 page.locator(f'[data-layer-toggle="solo"][data-id="{selected_id}"]').click()
 ok('Solo isolates selected layer',len(page.evaluate('aether.evaluate(aether.getTime())'))==1)
 page.locator(f'[data-layer-toggle="solo"][data-id="{selected_id}"]').click()
 # Import pixels into a real layer.
 page.locator('#media-input').set_input_files(str(OUT/'test-import.png'))
 page.wait_for_function('aether.getDocument().layers[0].type==="image"')
 ok('Image media import',page.evaluate('aether.getDocument().layers[0].data.assetId')!='')
 # Save and reopen an embedded-media project.
 with page.expect_download() as event: page.evaluate("aether.dispatch('save')")
 event.value.save_as(OUT/'test-project.aether')
 payload=json.loads((OUT/'test-project.aether').read_text())
 ok('Project file includes media and editable tracks',len(payload['assets'])==1 and len(payload['document']['layers'])==13)
 page.evaluate("aether.dispatch('demo')")
 page.locator('#project-input').set_input_files(str(OUT/'test-project.aether'))
 page.wait_for_function('aether.getDocument().layers.length===13')
 ok('Project roundtrip loads embedded media',page.evaluate('aether.getDocument().layers[0].type')=='image')
 page.wait_for_timeout(1300);page.reload(wait_until='networkidle');page.wait_for_function('!!window.aether')
 ok('IndexedDB autosave survives reload',page.evaluate('aether.getDocument().layers.length')==13)
 # Export known geometry and check encoded output independently.
 testdoc=page.evaluate('aether.getDocument()');testdoc.update(name='Export validation',width=320,height=180,fps=10,duration=1.2,workIn=0,workOut=1.2,background='#102030',transparent=False,markers=[])
 shape=rect.copy();shape.update(id='export-shape',name='Moving square',x=40,y=90,width=40,height=40,rotation=0,opacity=100,start=0,end=1.2,scaleX=100,scaleY=100,tracks={'x':[{'id':'a','t':0,'v':40,'ease':'linear'},{'id':'b','t':1.1,'v':280,'ease':'linear'}]},data={'color':'#ff8040','roundness':0})
 testdoc['layers']=[shape]
 page.evaluate('(d)=>aether.loadDocument(d)',testdoc);page.wait_for_timeout(500)
 with page.expect_download() as event:page.evaluate("aether.dispatch('snapshot')")
 event.value.save_as(OUT/'test-render.png')
 im=Image.open(OUT/'test-render.png');ok('PNG export dimensions and pixels',im.size==(320,180) and im.getpixel((40,90))[0]>200)
 data=page.evaluate('async()=>{const blob=await aether.testExport({});return await new Promise(r=>{let f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob)})}')
 (OUT/'test-render.webm').write_bytes(base64.b64decode(data.split(',')[1]))
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,width,height,nb_read_frames:format=duration','-of','json',str(OUT/'test-render.webm')]))
 ok('WebM decodes to exact frame count and resolution',info['streams'][0]['width']==320 and info['streams'][0]['nb_read_frames']=='12')
 ok('WebM duration matches the composition',abs(float(info['format']['duration'])-1.2)<.001)
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(OUT/'test-render.webm'),'-frames:v','1',str(OUT/'test-video-first.png')],check=True)
 im=Image.open(OUT/'test-video-first.png');ok('WebM contains real composition pixels, not a blank canvas',im.getpixel((40,90))[0]>180)
 # Import and seek the actual video previously rendered.
 page.locator('#media-input').set_input_files(str(OUT/'test-render.webm'))
 page.wait_for_function('aether.getDocument().layers[0].type==="video"')
 ok('Video import and decoder',page.evaluate('aether.getDocument().layers[0].end')>1)
 page.evaluate('aether.setTime(.5)');page.wait_for_timeout(700)
 ok('Video timeline seeking',not errors)
 # Verify premultiplied alpha via GPU readback.
 alpha=dict(testdoc);alpha['transparent']=True;alpha['layers']=[dict(shape,opacity=50,tracks={})]
 page.evaluate('(d)=>aether.loadDocument(d)',alpha);page.wait_for_timeout(200)
 pixel=page.evaluate('async()=>{const r=aether.getRenderer();r.render(aether.getDocument(),aether.evaluate(0),1);const c=await r.capture();return Array.from(c.getContext("2d").getImageData(40,90,1,1).data)}')
 ok('GPU premultiplied-alpha readback unpremultiplies correctly',abs(pixel[0]-255)<=2 and abs(pixel[3]-128)<=1)
 # Pixel-level blend conformance with nontrivial source alpha.
 conformance=dict(testdoc,width=64,height=64,duration=1,workOut=1,transparent=True)
 bottom=dict(shape,id='backdrop',x=32,y=32,width=64,height=64,opacity=100,tracks={},data={'color':'#4080c0','roundness':0})
 top=dict(shape,id='foreground',x=32,y=32,width=64,height=64,opacity=50,tracks={},data={'color':'#a06020','roundness':0})
 cb=[64/255,128/255,192/255];cs=[160/255,96/255,32/255]
 blend_functions={
  'normal':lambda b,s:s, 'multiply':lambda b,s:b*s,
  'screen':lambda b,s:1-(1-b)*(1-s), 'add':lambda b,s:min(1,b+s),
  'overlay':lambda b,s:2*b*s if b<=.5 else 1-2*(1-b)*(1-s),
  'difference':lambda b,s:abs(b-s)}
 capture_pixel="""async d=>{aether.loadDocument(d);const r=aether.getRenderer();r.render(d,aether.evaluate(0),1);const c=await r.capture();return Array.from(c.getContext('2d').getImageData(32,32,1,1).data)}"""
 for name,fn in blend_functions.items():
  conformance['layers']=[dict(top,blend=name),bottom]
  actual=page.evaluate(capture_pixel,conformance)
  expected=[round((b*.5+fn(b,s)*.5)*255) for b,s in zip(cb,cs)]
  ok('GPU blend reference: '+name,all(abs(a-b)<=2 for a,b in zip(actual[:3],expected)) and actual[3]==255)
 conformance['layers']=[dict(top,opacity=100,exposure=1,data={'color':'#402010','roundness':0})]
 pixel=page.evaluate(capture_pixel,conformance)
 ok('GPU exposure effect doubles encoded channel values',all(abs(a-b)<=2 for a,b in zip(pixel,[128,64,32,255])))
 conformance['layers']=[dict(top,opacity=100,data={'color':'#ffffff','roundness':0,'mask':'ellipse'})]
 pixel=page.evaluate(capture_pixel.replace('getImageData(32,32','getImageData(1,1'),conformance)
 ok('Ellipse mask clips source alpha',pixel[3]==0)
 for effect in ['blur','glow']:
  conformance['layers']=[dict(top,opacity=100,width=32,height=32,**{effect:18},data={'color':'#ffffff','roundness':0})]
  pixel=page.evaluate(capture_pixel.replace('getImageData(32,32','getImageData(12,32'),conformance)
  ok('GPU '+effect+' spreads beyond source bounds',pixel[3]>0)
 ok('No JavaScript or GPU validation errors',not errors and not gpu_errors)
 # A clean context proves default startup, independent of previous editor state.
 preview=browser.new_page(viewport={'width':1600,'height':1000})
 preview.goto(BASE_URL,wait_until='networkidle');preview.wait_for_function('!!window.aether');preview.wait_for_timeout(1200)
 preview.screenshot(path=str(OUT/'aether-motion-preview.png'),full_page=True)
 preview.close()
 # Test the portable bundle independently in a second browser context.
 second=browser.new_page(viewport={'width':1440,'height':900})
 second.goto(BASE_URL+'/AetherMotion.html?renderer=canvas',wait_until='networkidle');second.wait_for_function('!!window.aether')
 ok('Portable single-file build starts',second.evaluate('aether.getRenderer().kind')=='Canvas 2D')
 second.locator('[data-action="play"]').first.click();second.wait_for_timeout(300);second.evaluate("aether.dispatch('play')")
 ok('Canvas fallback playback advances the timeline',second.evaluate('aether.getTime()')>2.4)
 second.close();browser.close()
 (OUT/'integration-results.json').write_text(json.dumps({'passed':len(results),'checks':results,'errors':errors,'gpu_errors':gpu_errors,'video':info,'environment':{'browser':browser_version,'platform':platform.platform(),'software_gpu':SOFTWARE_GPU,'headless':HEADLESS},'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2))
 print(json.dumps({'passed':len(results),'errors':errors,'gpu_errors':gpu_errors},indent=2))
