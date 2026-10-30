# BẰNG CHỨNG KỸ THUẬT VÀ LOG KIỂM TOÁN (EVIDENCE - ĐÃ LÀM SẠCH)

> **Ghi chú an toàn:** Toàn bộ thông tin cá nhân khách hàng, số điện thoại thật, cookie và phiên đăng nhập đã được loại bỏ hoặc thay thế bằng dữ liệu ẩn danh/dữ liệu giả lập theo đúng quy tắc an toàn.

---

## 1. Nút gọi mở form trên bảng danh sách bưu gửi (`van-don.html`)

```html
<a class="btn btn-xs btn-primary" href="#" 
   onclick="GetUpdateItemForward('[MA_VAN_DON]', 'C39', '[TEN_NGUOI_NHAN]', '[DIA_CHI_NGUOI_NHAN]')">
   <i class="fa fa-pencil"></i> <span class="glyphicon"></span> Thêm thông tin chuyển tiếp
</a>
```

---

## 2. Mã nguồn hàm nạp Form Chuyển tiếp (`GetUpdateItemForward`)

```javascript
function GetUpdateItemForward(ladingCode, statusCode, receiverName, receiverAddress) {
    common.StartLoading();

    $.ajax({
        url: "/Lading/LadingJourney/GetByLadingCode",
        data: { 
            ladingCode: ladingCode, 
            statusCode: statusCode, 
            receiverName: receiverName, 
            receiverAddress: receiverAddress 
        },
        dataType: "html",
        type: "Get",
        success: function (data) {
            common.EndLoading();
            $("#md_update_item_forward_container").html(data);
            $('#md_update_item_forward').modal('toggle');
            $("#md_update_item_forward").show();
        },
        error: function (xhr, textStatus, errorThrown) {
            common.EndLoading();
        }
    });
}
```

---

## 3. Mã nguồn hàm cập nhật chuyển tiếp (`UpdateItemForward`)

```javascript
function UpdateItemForward(){
    var _addressReturnType = $("input[name='ckAddressReturnType']:checked").val();

    if (_addressReturnType == 2) {
        $('#txtOtherPostOffice').addClass("validate[required]");
    }
    else if (_addressReturnType == 3) {
        $('#cbProvince').addClass("validate[required]");
        $('#cbWard').addClass("validate[required]");
    }

    var valid = $('#fUpdateItemForward').validationEngine('validate');
    if (valid != true) return;

    common.StartLoading();
    // _newModel được nhúng trực tiếp trong HTML trả về từ GetByLadingCode
    _newModel.ReceiverNameReturn = $('#ReceiverNameReturn').val();
    _newModel.ReceiverAddressReturn = $('#ReceiverAddressReturn').val();
    _newModel.NextPhone = $('#NextPhone').val();
    _newModel.NextEmail = $('#NextEmail').val();
    _newModel.AddressReturnType = $("input[name='ckAddressReturnType']:checked").val();

    if (_newModel.AddressReturnType == "2"){
        _newModel.AddressReturn = $('#txtOtherPostOffice').val();
    }
    else if (_newModel.AddressReturnType == "3"){
        _newModel.AddressReturn = $('#cbProvince').val() + ";" + $('#cbWard').val();
    }

    _newModel.NoteReturn = $('#NoteReturn').val();

    $.ajax({
        url: "/Lading/LadingJourney/UpdateItemForward",
        dataType: "json",
        type: "POST",
        data: { value: _newModel },

        success: function (data) {
            common.EndLoading();
            if (data.Code == "00") {
                common.Message("Thành công", data.Message, "success");
                $("#md_update_item_forward").modal('hide');
                $("#md_update_item_forward_container").html('');
            }
            else {
                common.Message("Không thành công - " + data.Code, data.Message, "error");
            }
        }, 
        error: function (xhr, textStatus, errorThrown) {
            common.EndLoading();
            if (xhr.status != 200) {
                common.Message("Lỗi", "Hãy kiểm tra lại đường truyền trước khi thực hiện thao tác.", "error");
            }
        }
    });
}
```

---

## 4. Mã nguồn xử lý Tỉnh / Xã và Loại địa chỉ

```javascript
function ProvinceChange(provinceId) {
    $("#cbWard").html("<option value=''>---Phường, xã---</option>");

    if (provinceId == "" || provinceId == null || provinceId == undefined) return;

    $.ajax({
        url: "/Order/Home/GetWard",
        dataType: "json",
        type: "Get",
        data: { ProvinceId: provinceId },
        success: function (data) {
            var html = "";
            $.each(data, function (i, val) {
                html += "<option value='" + val.Value + "'>" + val.Text + "</option>";
            });
            $("#cbWard").html(html);
        }
    });
}

function AddressReturnTypeChange(value){
    // Bưu cục mới
    if(value == 2){
        $("#txtOtherPostOffice").removeAttr("disabled", "disabled");
        $("#txtOtherPostOffice").val('');
        $("#cbProvince").attr("disabled", "disabled");
        $("#cbWard").attr("disabled", "disabled");
        $("#cbProvince").val('');
        $("#cbWard").val('');
    }

    // Địa chỉ
    if(value == 3){
        $("#txtOtherPostOffice").attr("disabled", "disabled");
        $("#txtOtherPostOffice").val('');
        $("#cbProvince").removeAttr("disabled", "disabled");
        $("#cbWard").removeAttr("disabled", "disabled");
        $("#cbProvince").val('');
        $("#cbWard").val('');
    }
}
```

---

## 5. Cấu trúc Schema Response API Phường/Xã (`/Order/Home/GetWard`)

```json
[
  {
    "Disabled": false,
    "Group": null,
    "Selected": false,
    "Text": "--- Phường, xã ---",
    "Value": ""
  },
  {
    "Disabled": false,
    "Group": null,
    "Selected": false,
    "Text": "A Lưới 1",
    "Value": "53764"
  },
  {
    "Disabled": false,
    "Group": null,
    "Selected": false,
    "Text": "A Lưới 2",
    "Value": "53766"
  }
]
```
