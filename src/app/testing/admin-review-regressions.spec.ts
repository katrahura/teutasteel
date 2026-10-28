import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { TranslateService } from '@ngx-translate/core';
import { AdminShellComponent } from '../pages/admin/admin-shell.component';
import { of } from 'rxjs';
import { ProductEditorComponent } from '../pages/admin/products/product-editor.component';
import { AdminProductsComponent } from '../pages/admin/products/admin-products.component';
import { AdminContentComponent } from '../pages/admin/content/admin-content.component';
import { CloudinaryService } from '../services/cloudinary.service';
import { AdminSessionService } from '../services/admin-session.service';
import { AdminService } from '../services/admin.service';
import { AuthService } from '../services/auth.service';
import { unsavedChangesGuard } from '../guards/unsaved-changes.guard';
import { provideTestConfig } from './test-providers';

describe('Admin review regressions', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[ProductEditorComponent,AdminProductsComponent,AdminContentComponent,AdminShellComponent], providers:[provideTestConfig()]}).compileComponents();
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); localStorage.removeItem('token'); });
  const editor = () => {
    const fixture=TestBed.createComponent(ProductEditorComponent); const c=fixture.componentInstance;
    c.loaded=true; c.product={id:5,code:'PROFILE',cut_type:0,is_active:true,new_product:false,dimensions:[{id:1,price:10,currency:'EUR'}],translations:[],version:1};
    c.mediaConfig={configured:true,cloud_name:'test',upload_preset:'test',folder:'test'};
    c.image={file_name:'old.webp',alternative_text:'Profile',thumbnail_path:'old.webp',original_path:'old.webp'};
    c.thumbnailPath='old.webp'; c.originalPath='old.webp';
    (c as any).loadedId=5; (c as any).markClean();
    return {fixture,c};
  };
  it('sends the new uploaded image URLs in the actual save request', fakeAsync(() => {
    const {fixture,c}=editor();
    spyOn(c,'ensureMediaConfig');
    spyOn(TestBed.inject(CloudinaryService),'upload').and.returnValue(Promise.resolve('https://example.test/new.webp'));
    c.onImage({target:{files:[new File(['image'],'new.webp',{type:'image/webp'})]}} as unknown as Event);
    flushMicrotasks(); c.updateProduct();
    const request=TestBed.inject(HttpTestingController).expectOne(r=>r.method==='PUT');
    expect(request.request.body.image_asset.thumbnail_path).toBe('https://example.test/new.webp');
    expect(request.request.body.image_asset.original_path).toBe('https://example.test/new.webp');
    request.flush({...c.product,version:2}); fixture.destroy();
  }));
  it('aborts a cancelled upload and ignores any late success without losing the original image', fakeAsync(() => {
    const {fixture,c}=editor(); let resolve!: (url:string)=>void; let signal:AbortSignal|undefined;
    spyOn(c,'ensureMediaConfig');
    spyOn(TestBed.inject(CloudinaryService),'upload').and.callFake((_file,_config,_progress,s) => { signal=s; return new Promise(done=>resolve=done); });
    c.onImage({target:{files:[new File(['image'],'new.webp',{type:'image/webp'})]}} as unknown as Event);
    c.cancelUpload(); expect(signal?.aborted).toBeTrue();
    resolve('https://example.test/late.webp'); flushMicrotasks();
    expect(c.thumbnailPath).toBe('old.webp'); expect(c.uploading).toBeFalse(); fixture.destroy();
  }));
  it('does not let a cancelled upload clear a newer upload state', fakeAsync(() => {
    const {fixture,c}=editor();const finish: ((url:string)=>void)[]=[];
    spyOn(c,'ensureMediaConfig');
    spyOn(TestBed.inject(CloudinaryService),'upload').and.callFake(()=>new Promise(done=>finish.push(done)));
    const event={target:{files:[new File(['image'],'new.webp',{type:'image/webp'})]}} as unknown as Event;
    c.onImage(event);c.cancelUpload();c.onImage(event);
    finish[0]('https://example.test/obsolete.webp');flushMicrotasks();
    expect(c.uploading).toBeTrue();expect(c.thumbnailPath).toBe('old.webp');
    finish[1]('https://example.test/current.webp');flushMicrotasks();
    expect(c.uploading).toBeFalse();expect(c.thumbnailPath).toBe('https://example.test/current.webp');fixture.destroy();
  }));
  it('resets the form when switching an existing editor to create mode', () => {
    const {fixture,c}=editor();c.newProduct=true;c.productId=null;
    c.ngOnChanges({newProduct:{} as any});
    expect(c.product.code).toBe('');expect(c.product.id).toBeUndefined();expect(c.product.is_active).toBeFalse();
    expect(c.dirty).toBeFalse();fixture.destroy();
  });
  it('retains typed values after a failed save', () => {
    const {fixture,c}=editor(); c.product.code='KEEP THIS'; c.updateProduct();
    TestBed.inject(HttpTestingController).expectOne(r=>r.method==='PUT').flush({error:'Invalid',details:{code:'Try again'}},{status:400,statusText:'Bad request'});
    expect(c.product.code).toBe('KEEP THIS'); expect(c.dirty).toBeTrue(); fixture.destroy();
  });
  it('does not let parent Close, Escape, Create or another row bypass dirty protection', () => {
    const f=TestBed.createComponent(AdminProductsComponent); const c=f.componentInstance;
    c.openId=5; c.openedCode='FIRST'; c.editor={canLeave:()=>false} as ProductEditorComponent;
    c.closeEditor(); c.onEscape(); c.startCreate(); c.open({id:9,code:'OTHER'} as any);
    expect(c.openId).toBe(5); expect(c.openedCode).toBe('FIRST'); expect(c.creating).toBeFalse();
    expect((unsavedChangesGuard as Function)(c)).toBeFalse(); f.destroy();
  });
  it('warns before navigation away from unsaved service content', () => {
    const f=TestBed.createComponent(AdminContentComponent);const c=f.componentInstance;
    c.rows=[{id:'cnc',title_en:'Saved'} as any]; (c as any).snapshots=new Map([['cnc',JSON.stringify(c.rows[0])]]);
    expect(c.dirty).toBeFalse();c.rows[0].title_en='Unsaved';spyOn(window,'confirm').and.returnValue(false);
    expect((unsavedChangesGuard as Function)(c)).toBeFalse();f.destroy();
  });
  it('refreshes capabilities across account changes and forgets them on logout', () => {
    const api=TestBed.inject(AdminService); const session=TestBed.inject(AdminSessionService); const auth=TestBed.inject(AuthService);
    const get=spyOn(api,'getMe').and.returnValue(of({id:1,role:'admin',can_enter_admin:true,capabilities:['settings.write']} as any));
    auth.storeToken('first-account');session.me().subscribe();expect(session.can('settings.write')).toBeTrue();
    auth.storeToken('second-account');expect(session.peek()).toBeNull();
    get.and.returnValue(of({id:2,role:'editor',can_enter_admin:true,capabilities:[]} as any));
    session.me().subscribe();expect(get).toHaveBeenCalledTimes(2);expect(session.can('settings.write')).toBeFalse();
    auth.logout();expect(session.peek()).toBeNull();expect(session.canEnterAdmin()).toBeFalse();
  });
  it('refuses to apply an import whose reviewed file changed', () => {
    const f=TestBed.createComponent(AdminProductsComponent);const c=f.componentInstance;
    const api=spyOn(TestBed.inject(AdminService),'importThickness');
    c.importCsv='changed';(c as any).reviewedCsv='original';(c as any).importPreviewToken='token';c.applyImport();
    expect(api).not.toHaveBeenCalled();f.destroy();
  });
  it('switches the admin interface language and remembers it', () => {
    const f=TestBed.createComponent(AdminShellComponent);
    const use=spyOn(TestBed.inject(TranslateService),'use').and.returnValue(of({}));
    f.componentInstance.switchLanguage('en');
    expect(use).toHaveBeenCalledWith('en'); expect(localStorage.getItem('language')).toBe('en');
    localStorage.removeItem('language'); f.destroy();
  });
  it('actually aborts the upload request through the shared upload service', fakeAsync(() => {
    const xhr:any={open:jasmine.createSpy(),send:jasmine.createSpy(),upload:{},abort:()=>xhr.onabort()};
    spyOn(window,'XMLHttpRequest').and.returnValue(xhr);
    const abort=new AbortController();let reason='';
    TestBed.inject(CloudinaryService).upload(new File(['image'],'image.png',{type:'image/png'}),{configured:true,cloud_name:'test',upload_preset:'test',folder:'test'},undefined,abort.signal).catch(error=>reason=error.name);
    abort.abort();flushMicrotasks();expect(reason).toBe('AbortError');expect(xhr.send).toHaveBeenCalled();
  }));
});
